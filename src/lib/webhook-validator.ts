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

/**
 * Validates the timestamp of incoming webhooks to prevent Replay Attacks.
 * Ensures the timestamp is within the allowed 5-minute tolerance window.
 * @param incomingTimestamp The timestamp sent with the webhook (in seconds).
 */
export function validateWebhookTimestamp(incomingTimestamp: number): boolean {
  const currentServerTime = Math.floor(Date.now() / 1000);
  const timeToleranceInSeconds = 300; // 5-minute window

  if (Math.abs(currentServerTime - incomingTimestamp) > timeToleranceInSeconds) {
    throw new Error("Security Alert: Webhook timestamp variance too high. Potential Replay Attack.");
  }
  return true;
}
