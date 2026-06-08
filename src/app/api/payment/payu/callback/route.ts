import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { apiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { resolveSiteUrl } from '@/lib/site-url';
import { normalisePayuEnvironment, verifyPayuHash, type PayuConfig, type PayuEnvironment } from '@/lib/payu-service';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// Simple in-memory cache for settings to reduce DB load on high-frequency callbacks
const SETTINGS_CACHE: Record<string, { value: string, expiry: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedSetting(key: string): Promise<string> {
  const cached = SETTINGS_CACHE[key];
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }
  return '';
}

function setCachedSetting(key: string, value: string) {
  SETTINGS_CACHE[key] = { value, expiry: Date.now() + CACHE_TTL };
}

function resolveEnvironmentPreference(envs: Array<string | null | undefined>): PayuEnvironment {
  const normalisedValues = envs
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
    .map(candidate => normalisePayuEnvironment(candidate));

  if (normalisedValues.includes('production')) {
    return 'production';
  }

  if (normalisedValues.includes('test')) {
    return 'test';
  }

  return 'test';
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();
  const siteUrl = resolveSiteUrl(request.headers.get('host') || undefined);

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return apiError('SERVICE_UNAVAILABLE', {
        correlationId,
        overrideMessage: 'Service configuration error. Please contact support.',
      });
    }

    const formData = await request.formData();
    const payload: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        payload[key] = value;
      }
    }

    const orderId = payload.udf1 || payload.orderId || '';
    const txnId = payload.txnid || '';
    const status = (payload.status || '').toLowerCase();

    // Fetch settings with caching to reduce DB pressure
    let dbMerchantKey = await getCachedSetting('payu_merchant_key');
    let dbMerchantSalt = await getCachedSetting('payu_merchant_salt');
    let dbEnvironment = await getCachedSetting('payu_environment');
    let dbEnabled = await getCachedSetting('payu_enabled') || 'true';

    if (!dbMerchantKey || !dbMerchantSalt) {
      try {
        const { data: dbSettings } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', ['payu_merchant_key', 'payu_merchant_salt', 'payu_environment', 'payu_enabled']);
        if (dbSettings) {
          const k = dbSettings.find(s => s.key === 'payu_merchant_key')?.value || '';
          const s = dbSettings.find(s => s.key === 'payu_merchant_salt')?.value || '';
          const e = dbSettings.find(s => s.key === 'payu_environment')?.value || '';
          const en = dbSettings.find(s => s.key === 'payu_enabled')?.value || 'true';
          
          if (k) setCachedSetting('payu_merchant_key', k);
          if (s) setCachedSetting('payu_merchant_salt', s);
          if (e) setCachedSetting('payu_environment', e);
          setCachedSetting('payu_enabled', en);
          
          dbMerchantKey = k;
          dbMerchantSalt = s;
          dbEnvironment = e;
          dbEnabled = en;
        }
      } catch (err) {
        logger.error('Failed to load PayU settings from DB', { error: err, correlationId });
      }
    }

    const payuConfig = {
      enabled: dbEnabled === 'true',
      config: {
        environment: dbEnvironment || process.env.PAYU_ENVIRONMENT || 'test'
      }
    };

    const rawConfig = (payuConfig.config ?? {}) as any;
    const envMerchantKey = (process.env.PAYU_MERCHANT_KEY || '').trim();
    const envMerchantSalt = (process.env.PAYU_MERCHANT_SALT || '').trim();

    const deriveMerchantKey = (): string => {
      if (dbMerchantKey) return dbMerchantKey;
      if (typeof rawConfig.merchantKey === 'string' && rawConfig.merchantKey.trim()) {
        return rawConfig.merchantKey.trim();
      }
      const rawRecord = rawConfig as Record<string, unknown>;
      if (typeof rawRecord.key === 'string' && rawRecord.key.trim()) {
        return rawRecord.key.trim();
      }
      if (typeof rawRecord.merchant_key === 'string' && rawRecord.merchant_key.trim()) {
        return rawRecord.merchant_key.trim();
      }
      return envMerchantKey;
    };

    const deriveMerchantSalt = (): string => {
      if (dbMerchantSalt) return dbMerchantSalt;
      if (typeof rawConfig.merchantSalt === 'string' && rawConfig.merchantSalt.trim()) {
        return rawConfig.merchantSalt.trim();
      }
      const rawRecord = rawConfig as Record<string, unknown>;
      if (typeof rawRecord.merchant_salt === 'string' && rawRecord.merchant_salt.trim()) {
        return rawRecord.merchant_salt.trim();
      }
      if (typeof rawRecord.salt === 'string' && rawRecord.salt.trim()) {
        return rawRecord.salt.trim();
      }
      return envMerchantSalt;
    };

    const merchantKey = deriveMerchantKey();
    const merchantSalt = deriveMerchantSalt();

    if (!merchantKey || !merchantSalt) {
      logger.error('payu_callback.config_missing', { correlationId, orderId, txnId });
      return apiError('SERVICE_UNAVAILABLE', {
        correlationId,
        overrideMessage: 'PayU configuration incomplete',
      });
    }

    const environment = resolveEnvironmentPreference([
      typeof rawConfig.environment === 'string' ? rawConfig.environment : null,
      process.env.PAYU_ENVIRONMENT,
      process.env.PAYU_MODE,
      process.env.PAYU_GATEWAY_ENV,
    ]);

    const isHashValid = verifyPayuHash(
      {
        merchantKey,
        merchantSalt,
        environment,
      } satisfies PayuConfig,
      payload
    );

    const isGatewayReportedSuccess = status === 'success';

    // STRICT PAYMENT CHECK: Terminate immediately if hash verification fails to prevent spoofing
    if (!isHashValid) {
      logger.error('payu_callback.signature_verification_failed', { correlationId, orderId, txnId });

      const failureUrl = new URL(`/payment/failed`, siteUrl);
      failureUrl.searchParams.set('orderId', orderId);
      failureUrl.searchParams.set('reason', 'Cryptographic signature verification failed.');
      return NextResponse.redirect(failureUrl, 303);
    }

    const isSuccess = isGatewayReportedSuccess;
    const amountNumber = Number(payload.amount);

    if (!orderId || !txnId || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      logger.warn('payu_callback.missing_or_invalid_reference', { correlationId, orderId, txnId, amount: payload.amount });
      const fallbackUrl = new URL(`/payment/failed`, siteUrl);
      fallbackUrl.searchParams.set('reason', 'Invalid payment reference.');
      return NextResponse.redirect(fallbackUrl, 303);
    }

    const { data: existingTxn, error: existingTxnError } = await supabase
      .from('payment_transactions')
      .select('order_id, amount, status')
      .eq('transaction_id', txnId)
      .maybeSingle();

    if (existingTxnError || !existingTxn) {
      logger.warn('payu_callback.unknown_transaction', { correlationId, orderId, txnId, error: existingTxnError?.message });
      const failureUrl = new URL(`/payment/failed`, siteUrl);
      failureUrl.searchParams.set('orderId', orderId);
      failureUrl.searchParams.set('reason', 'Unknown payment transaction.');
      return NextResponse.redirect(failureUrl, 303);
    }

    const expectedAmount = Number(existingTxn.amount);
    if (
      existingTxn.order_id !== orderId ||
      !Number.isFinite(expectedAmount) ||
      Math.abs(expectedAmount - amountNumber) > 0.01
    ) {
      logger.error('payu_callback.transaction_mismatch', {
        correlationId,
        orderId,
        txnId,
        expectedOrderId: existingTxn.order_id,
        expectedAmount,
        receivedAmount: amountNumber,
      });
      const failureUrl = new URL(`/payment/failed`, siteUrl);
      failureUrl.searchParams.set('orderId', orderId);
      failureUrl.searchParams.set('reason', 'Payment transaction mismatch.');
      return NextResponse.redirect(failureUrl, 303);
    }

    const transactionUpsert = {
      order_id: orderId,
      transaction_id: txnId,
      payment_method: 'payu',
      status: isSuccess ? 'success' : 'failed',
      gateway_response: { ...payload, hash_verified: true },
      updated_at: new Date().toISOString(),
    };

    const { error: txnUpdateError } = await supabase
      .from('payment_transactions')
      .upsert(transactionUpsert, { onConflict: 'transaction_id' });

    if (txnUpdateError) {
      logger.error('payu_callback.transaction_update_failed', {
        correlationId,
        orderId,
        txnId,
        error: txnUpdateError.message,
      });
    }

    if (orderId) {
      if (isSuccess) {
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            status: 'Payment Confirmed',
            payment_status: 'Payment Confirmed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)
          .not('status', 'in', '(Cancelled,Rejected,Completed,Delivered)');

        if (orderUpdateError) {
          logger.error('payu_callback.order_update_failed', {
            correlationId,
            orderId,
            txnId,
            error: orderUpdateError.message,
          });
        }
      } else {
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'Payment Failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)
          .not('status', 'in', '(Cancelled,Rejected,Completed,Delivered)');

        if (orderUpdateError) {
          logger.error('payu_callback.order_mark_failed_failed', {
            correlationId,
            orderId,
            txnId,
            error: orderUpdateError.message,
          });
        }

        // High-Velocity Recovery Logic
        await triggerPaymentRecovery(orderId, payload, new URL(siteUrl));
      }
    }

    if (!orderId) {
      const fallbackUrl = new URL(`/payment/failed`, siteUrl);
      fallbackUrl.searchParams.set('reason', 'Order reference missing.');
      return NextResponse.redirect(fallbackUrl, 303);
    }

    if (isSuccess) {
      const successUrl = new URL(`/payment/success`, siteUrl);
      successUrl.searchParams.set('orderId', orderId);
      if (txnId) {
        successUrl.searchParams.set('txnId', txnId);
      }
      if (payload.amount) {
        successUrl.searchParams.set('amount', payload.amount);
      }
      if (payload.bank_ref_num) {
        successUrl.searchParams.set('reference', payload.bank_ref_num);
      }
      logger.info('payu_callback.success', { correlationId, orderId, txnId });
      return NextResponse.redirect(successUrl, 303);
    }

    const failureUrl = new URL(`/payment/failed`, siteUrl);
    failureUrl.searchParams.set('orderId', orderId);
    const reason = payload.error_Message || payload.field9 || status || 'Payment failed';
    failureUrl.searchParams.set('reason', reason);
    logger.warn('payu_callback.failure', { correlationId, orderId, txnId, reason, hashValid: true, gatewayStatus: status });
    return NextResponse.redirect(failureUrl, 303);
  } catch (error) {
    logger.error('payu_callback.unhandled', {
      correlationId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return apiError('INTERNAL_ERROR', {
      correlationId,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

/**
 * Initiates high-velocity payment recovery record and dispatch
 */
async function triggerPaymentRecovery(orderId: string, payload: any, siteUrl: URL) {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('customer_email, customer_phone, total')
      .eq('id', orderId)
      .single();

    if (!order) return;

    // 1. Create Recovery Record
    const { data: recovery } = await supabase
      .from('payment_recovery_queue')
      .insert([{
        order_id: orderId,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        failure_reason: payload.error_Message || payload.field9 || 'Bank Authorization Failed',
        recovery_status: 'urgent'
      }])
      .select()
      .single();

    // 2. Immediate Webhook Dispatch for Outreach (Simulated)
    // In production, this would hit a CRM or high-priority support queue
    const outreachPayload = {
      orderId,
      customer: { email: order.customer_email, phone: order.customer_phone },
      amount: order.total,
      recoveryUrl: `${siteUrl.origin}/payment/retry/${orderId}`,
      timestamp: new Date().toISOString()
    };

    // Fast-track bypass dispatch
    fetch(process.env.RECOVERY_OUTREACH_WEBHOOK_URL || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Priority': 'high' },
      body: JSON.stringify(outreachPayload)
    }).catch(e => logger.warn('recovery_webhook.dispatch_failed', { error: e }));

    logger.info('payment_recovery.initiated', { orderId, recoveryId: recovery?.id });
  } catch (err) {
    logger.error('payment_recovery.trigger_failed', { error: err, orderId });
  }
}
