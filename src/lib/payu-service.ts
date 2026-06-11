import crypto from 'crypto';
import { logger } from './logger';

export type PayuEnvironment = 'test' | 'production';

type PayuUdfKey =
  | 'udf1'
  | 'udf2'
  | 'udf3'
  | 'udf4'
  | 'udf5'
  | 'udf6'
  | 'udf7'
  | 'udf8'
  | 'udf9'
  | 'udf10';

export interface PayuConfig {
  merchantKey: string;
  merchantSalt: string;
  environment: PayuEnvironment;
}

export interface PayuRequestPayload extends Partial<Record<PayuUdfKey, string>> {
  txnId: string;
  amount: string;
  productInfo: string;
  firstName: string;
  email: string;
  phone?: string;
}

const GATEWAY_URL: Record<PayuEnvironment, string> = {
  test: 'https://test.payu.in/_payment',
  production: 'https://secure.payu.in/_payment',
};

import { verifyPaymentHash } from './crypto-utils';

export const sanitizeHashValue = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  return String(val).replace(/\|/g, '').trim().replace(/\s+/g, ' ');
};

function normaliseValue(value: string | number | null | undefined): string {
  if (value == null) {
    return '';
  }
  // Normalize numeric strings to 2 decimal places for cryptographic consistency
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value as any)) {
    return parseFloat(value).toFixed(2);
  }
  return sanitizeHashValue(value);
}

function collectUdfValues(source: Record<string, string | undefined>): string[] {
  return Array.from({ length: 10 }, (_, index) => {
    const key = `udf${index + 1}`;
    return normaliseValue(source[key]);
  });
}

function timingSafeSha512HexEqual(expectedHex: string, candidateHex: string | undefined): boolean {
  const cleanCandidate = candidateHex?.trim().toLowerCase() ?? '';
  const isValidSha512Hex = /^[a-f0-9]{128}$/.test(cleanCandidate);
  if (!isValidSha512Hex) return false;
  return verifyPaymentHash(cleanCandidate, expectedHex);
}

export function getPayuPaymentUrl(environment: PayuEnvironment): string {
  return GATEWAY_URL[environment] ?? GATEWAY_URL.test;
}

export function normalisePayuEnvironment(value: string | null | undefined): PayuEnvironment {
  if (!value) {
    return 'test';
  }

  const normalised = value.trim().toLowerCase();
  const condensed = normalised.replace(/[\s_-]+/g, '').replace(/[()]/g, '');

  if (
    condensed === 'production' ||
    condensed === 'prod' ||
    condensed === 'live' ||
    condensed === 'livemode' ||
    condensed === 'productionlive' ||
    condensed === 'golive'
  ) {
    return 'production';
  }

  if (
    condensed === 'sandbox' ||
    condensed === 'demo' ||
    condensed === 'uat' ||
    condensed === 'staging'
  ) {
    return 'test';
  }

  if (condensed.includes('live') || condensed.includes('prod')) {
    return 'production';
  }

  if (
    condensed.includes('sandbox') ||
    condensed.includes('demo') ||
    condensed.includes('test') ||
    condensed.includes('stage') ||
    condensed.includes('uat')
  ) {
    return 'test';
  }

  return normalised === 'production' || normalised === 'prod' || normalised === 'live'
    ? 'production'
    : 'test';
}

export function generatePayuHash(config: PayuConfig, payload: PayuRequestPayload): string {
  if (!config.merchantKey || !config.merchantSalt) {
    throw new Error('PayU signature generation failed: Merchant key or salt is missing.');
  }

  const udfValues = collectUdfValues(payload as unknown as Record<string, string | undefined>);
  const hashSequence = [
    config.merchantKey,
    payload.txnId,
    payload.amount,
    payload.productInfo,
    payload.firstName,
    payload.email,
    ...udfValues,
    config.merchantSalt,
  ].map(sanitizeHashValue).join('|');

  return crypto.createHash('sha512').update(hashSequence).digest('hex');
}

export function verifyPayuHash(config: PayuConfig, response: Record<string, string | undefined>): boolean {
  if (!response.hash) {
    return false;
  }

  if (!config.merchantKey || !config.merchantSalt) {
    logger.error('PayU signature verification failed: Merchant key or salt is missing.');
    return false;
  }

  const udfValuesForward = collectUdfValues(response);
  const udfValuesReversed = [...udfValuesForward].reverse();

  const placeholderSegments = ['', '', '', '', '', ''];

  const additionalCharges = normaliseValue(response.additionalCharges || (response as Record<string, string | undefined>)['additional_charges']);

  const baseSequence = [
    config.merchantSalt,
    normaliseValue(response.status),
    ...placeholderSegments,
    ...udfValuesReversed,
    normaliseValue(response.email),
    normaliseValue(response.firstname),
    normaliseValue(response.productinfo),
    normaliseValue(response.amount),
    normaliseValue(response.txnid),
    config.merchantKey,
  ];

  const hashSequence = additionalCharges
    ? [additionalCharges, ...baseSequence].map(sanitizeHashValue).join('|')
    : baseSequence.map(sanitizeHashValue).join('|');

  const expectedHash = crypto.createHash('sha512').update(hashSequence).digest('hex');
  return timingSafeSha512HexEqual(expectedHash, response.hash);
}
