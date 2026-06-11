import { Queue } from 'bullmq';
import { getRedis } from '../redis';
import { logger } from '../logger';

let emailQueue: Queue | null = null;

export function getEmailQueue(): Queue | null {
  if (emailQueue) return emailQueue;
  
  const redisConnection = getRedis();
  if (!redisConnection) {
    logger.warn('email_queue_disabled', { reason: 'Redis is not configured' });
    return null;
  }

  try {
    emailQueue = new Queue('email-delivery', {
      connection: redisConnection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
    logger.info('email_queue_initialized');
    return emailQueue;
  } catch (error) {
    logger.error('email_queue_init_failed', { error: (error as Error).message });
    return null;
  }
}
