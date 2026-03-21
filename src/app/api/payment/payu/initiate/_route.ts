import crypto from 'crypto';

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { rateLimit } from '../../../../../lib/rate-limit';
import { createClient as createServerClient } from '../../../../../lib/supabase/server';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { logger } from '../../../../../lib/logger';
import { resolveSiteUrl } from '../../../../../lib/site-url';
import { generatePayuHash, getPayuPaymentUrl, normalisePayuEnvironment, type PayuConfig, type PayuRequestPayload, type PayuEnvironment } from '../../../../../lib/payu-service';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const LIMIT = 5;
const WINDOW_MS = 60 * 1000;

function generateTransactionId(orderId: string): string {
  const cleanedOrder = orderId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6);
  const timestampFragment = Date.now().toString(36).toUpperCase();
  const randomFragment = Math.random().toString(36).slice(2, 8).toUpperCase();
  const candidate = `TB${cleanedOrder}${timestampFragment}${randomFragment}`;
  return candidate.slice(0, 25);
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

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return apiError('SERVICE_UNAVAILABLE', {
        correlationId,
        overrideMessage: 'Service configuration error. Please contact support.',
      });
    }

    const { orderId } = await request.json().catch(() => ({}));

    if (!orderId || typeof orderId !== 'string') {
      return apiError('VALIDATION_ERROR', {
        correlationId,
        overrideMessage: 'Missing or invalid orderId',
      });
    }

    let userId: string | null = null;
    try {
      const serverClient = await createServerClient();
      const { data } = await serverClient.auth.getUser();
      userId = data.user?.id ?? null;
    } catch (error) {
      logger.debug('payu_init.user_lookup_failed', { error: error instanceof Error ? error.message : String(error), correlationId });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = userId ? `user:${userId}` : `ip:${ip}`;

    if (!rateLimit(rateKey, 'payment_payu_initiate', { limit: LIMIT, windowMs: WINDOW_MS })) {
      logger.warn('payu_init.rate_limited', { rateKey, correlationId });
      return apiError('RATE_LIMITED', { correlationId });
    }

    // Payment settings are now managed via code/env vars
    // We skip the DB lookup and use hardcoded defaults + env vars
    const payuConfig = {
      enabled: true,
      config: {
        environment: process.env.PAYU_ENVIRONMENT || 'test'
      }
    };

    if (!payuConfig.enabled) {
      return apiError('VALIDATION_ERROR', {
        correlationId,
        overrideMessage: 'PayU payment method is disabled',
      });
    }

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

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total, customer_name, customer_email, customer_phone, items')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return apiError('NOT_FOUND', {
        correlationId,
        overrideMessage: 'Order not found',
      });
    }

    const amountNumber = Number(order.total ?? 0);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return apiError('VALIDATION_ERROR', {
        correlationId,
        overrideMessage: 'Order amount is invalid for payment',
      });
    }

    const amount = amountNumber.toFixed(2);
    const productInfo = `Order ${orderId}`.slice(0, 100) || 'TecBunny Order';
    const firstName = typeof order.customer_name === 'string' && order.customer_name.trim().length > 0
      ? order.customer_name.trim().split(' ')[0]
      : (process.env.PAYU_FALLBACK_FIRSTNAME || 'Customer');
    const email = typeof order.customer_email === 'string' && order.customer_email.trim().length > 0
      ? order.customer_email.trim()
      : (process.env.PAYU_FALLBACK_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@tecbunny.com');
    const phone = typeof order.customer_phone === 'string' && order.customer_phone.trim().length > 0
      ? order.customer_phone.trim()
      : (process.env.PAYU_FALLBACK_PHONE || '9999999999');

    const txnId = generateTransactionId(orderId);

    const siteUrl = resolveSiteUrl(request.headers.get('host') || undefined);
    const callbackUrl = `${siteUrl}/api/payment/payu/callback`;

    const payuPayload: PayuRequestPayload = {
      txnId,
      amount,
      productInfo,
      firstName,
      email,
      phone,
      udf1: orderId,
    };

    const hash = generatePayuHash(
      {
        merchantKey,
        merchantSalt,
        environment,
      } satisfies PayuConfig,
      payuPayload
    );

    const paymentParams = {
      key: merchantKey,
      txnid: txnId,
      amount,
      productinfo: productInfo,
      firstname: firstName,
      email,
      phone,
      surl: callbackUrl,
      furl: callbackUrl,
      hash,
      udf1: orderId,
      service_provider: 'payu_paisa',
    } as const;

    const { error: txnError } = await supabase
      .from('payment_transactions')
      .insert({
        order_id: orderId,
        transaction_id: txnId,
        payment_method: 'payu',
        amount: amountNumber,
        status: 'initiated',
        gateway_response: { request: paymentParams },
        created_at: new Date().toISOString(),
      });

    if (txnError) {
      logger.error('payu_init.transaction_store_failed', {
        error: txnError.message,
        orderId,
        correlationId,
      });
    }

    logger.info('payu_init.success', { orderId, txnId, correlationId });

    const response = apiSuccess(
      {
        paymentUrl: getPayuPaymentUrl(environment),
        params: paymentParams,
        transactionId: txnId,
        environment,
      },
      correlationId
    );

    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'same-origin');
    response.headers.set('Permissions-Policy', 'payment=()');

    return response;
  } catch (error) {
    logger.error('payu_init.unhandled', {
      correlationId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return apiError('INTERNAL_ERROR', {
      correlationId,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}
