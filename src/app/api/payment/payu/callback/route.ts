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

    // Default configuration parsing
    const payuConfig = {
      enabled: true,
      config: {
        environment: process.env.PAYU_ENVIRONMENT || 'test'
      }
    };

    const rawConfig = (payuConfig.config ?? {}) as any;
    const envMerchantKey = (process.env.PAYU_MERCHANT_KEY || '').trim();
    const envMerchantSalt = (process.env.PAYU_MERCHANT_SALT || '').trim();

    const deriveMerchantKey = (): string => {
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
      
      // Update transaction ledger with warning details
      await supabase
        .from('payment_transactions')
        .upsert({
          order_id: orderId || null,
          transaction_id: txnId || crypto.randomUUID(),
          payment_method: 'payu',
          status: 'failed',
          gateway_response: { ...payload, hash_verified: false, security_alert: 'Signature validation failed (possible tampering).' },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'transaction_id' });

      if (orderId) {
        await supabase
          .from('orders')
          .update({
            payment_status: 'Payment Failed',
            notes: 'PayU webhook failed cryptographic hash check.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);
      }

      const failureUrl = new URL(`/payment/failed`, siteUrl);
      failureUrl.searchParams.set('orderId', orderId);
      failureUrl.searchParams.set('reason', 'Cryptographic signature verification failed.');
      return NextResponse.redirect(failureUrl, 303);
    }

    const isSuccess = isGatewayReportedSuccess;

    const transactionUpsert = {
      order_id: orderId || null,
      transaction_id: txnId || crypto.randomUUID(),
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
          .eq('id', orderId);

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
          .eq('id', orderId);

        if (orderUpdateError) {
          logger.error('payu_callback.order_mark_failed_failed', {
            correlationId,
            orderId,
            txnId,
            error: orderUpdateError.message,
          });
        }
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
