import crypto from 'crypto';
import { logger } from '@/lib/logger';

/**
 * Validates custom webhook signature using HMAC-SHA256.
 * In development mode, skips validation unless signature and secret are provided.
 */
export function validateWebhookSignature(
  signature: string | null | undefined,
  bodyString: string,
  secret: string | null | undefined
): boolean {
  if (!secret) {
    logger.error('Webhook secret is not configured in the environment');
    return false;
  }

  if (!signature) {
    logger.error('Missing webhook signature');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyString)
      .digest('hex');

    // Handle signatures prefixed with "sha256=" or raw signatures
    const cleanSignature = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature;

    const signatureBuffer = Buffer.from(cleanSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      logger.error('Webhook signature validation failed: length mismatch');
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error: any) {
    logger.error('Webhook signature validation error:', { error: error.message });
    return false;
  }
}
