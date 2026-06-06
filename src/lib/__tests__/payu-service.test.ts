import { describe, expect, it } from 'vitest';
import crypto from 'crypto';

import { generatePayuHash, sanitizeHashValue, verifyPayuHash, type PayuConfig } from '../payu-service';

const config: PayuConfig = {
  merchantKey: 'merchant-key',
  merchantSalt: 'merchant-salt',
  environment: 'test',
};

describe('payu-service', () => {
  it('removes structural pipe delimiters and collapses whitespace before hashing', () => {
    expect(sanitizeHashValue('  Laptop | Pro   14  ')).toBe('Laptop Pro 14');
  });

  it('generates the same hash for clean and delimiter-polluted equivalent fields', () => {
    const cleanHash = generatePayuHash(config, {
      txnId: 'txn-1',
      amount: '100.00',
      productInfo: 'Laptop Pro 14',
      firstName: 'Ada',
      email: 'ada@example.com',
      udf1: 'standard',
    });

    const pollutedHash = generatePayuHash(config, {
      txnId: 'txn-1',
      amount: '100.00',
      productInfo: '  Laptop | Pro   14  ',
      firstName: 'Ada',
      email: ' ada@example.com ',
      udf1: 'standard|',
    });

    expect(pollutedHash).toBe(cleanHash);
  });

  it('verifies response hashes after normalizing delimiter-polluted response fields', () => {
    const response = {
      txnid: 'txn-1',
      amount: '100.00',
      productinfo: 'Laptop Pro 14',
      firstname: 'Ada',
      email: 'ada@example.com',
      status: 'success',
      udf1: 'standard',
    };

    const hash = generateReversePayuHash(config, response);

    expect(verifyPayuHash(config, {
      ...response,
      productinfo: ' Laptop | Pro   14 ',
      udf1: 'standard |',
      hash,
    })).toBe(true);
  });
});

function generateReversePayuHash(
  payuConfig: PayuConfig,
  response: Record<string, string>
) {
  const udfValues = Array.from({ length: 10 }, (_, index) => {
    return sanitizeHashValue(response[`udf${index + 1}`]);
  }).reverse();

  const sequence = [
    payuConfig.merchantSalt,
    sanitizeHashValue(response.status),
    ...Array(6).fill(''),
    ...udfValues,
    sanitizeHashValue(response.email),
    sanitizeHashValue(response.firstname),
    sanitizeHashValue(response.productinfo),
    sanitizeHashValue(response.amount),
    sanitizeHashValue(response.txnid),
    payuConfig.merchantKey,
  ].join('|');

  return crypto.createHash('sha512').update(sequence).digest('hex');
}
