import crypto from 'crypto';

/**
 * Constant-time string comparison to prevent microsecond side-channel analysis
 * and timing attacks during signature verification.
 */
export function verifyPaymentHash(incoming: string, computed: string): boolean {
  const bufferIncoming = Buffer.from(incoming, 'utf-8');
  const bufferComputed = Buffer.from(computed, 'utf-8');

  if (bufferIncoming.length !== bufferComputed.length) {
    return false;
  }

  // Executes true constant-time verification
  return crypto.timingSafeEqual(bufferIncoming, bufferComputed);
}
