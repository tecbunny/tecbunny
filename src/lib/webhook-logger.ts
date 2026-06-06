import { logger } from '@/lib/logger';

const WEBHOOK_LOG_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry<T>(operation: () => Promise<T>, context: Record<string, unknown>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= WEBHOOK_LOG_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.warn('webhook_log_retryable_failure', {
        ...context,
        attempt: attempt + 1,
        maxAttempts: WEBHOOK_LOG_RETRIES + 1,
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt < WEBHOOK_LOG_RETRIES) {
        await sleep(100 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

type SupabaseWriteResult = {
  error: { message: string } | null;
};

// Shared webhook event logging utility
export async function logWebhookEvent(
  supabase: any,
  eventType: string,
  payload: any,
  source: string,
  processed: boolean,
  errorMessage?: string,
  startTime?: Date,
  eventId?: string
) {
  try {
    const now = new Date();
    const processedAt = processed ? now.toISOString() : null;
    
    // Determine status based on processed flag and error
    let status = 'unknown';
    if (processed && !errorMessage) {
      status = 'processed';
    } else if (processed && errorMessage) {
      status = 'processed_with_warnings';
    } else if (!processed && errorMessage) {
      status = 'failed';
    } else {
      status = 'pending';
    }
 
    const webhookEvent = {
      source,
      event_type: eventType,
      payload,
      processed,
      status,
      error_message: errorMessage,
      created_at: startTime ? startTime.toISOString() : now.toISOString(),
      processed_at: processedAt,
      updated_at: now.toISOString(),
      event_id: eventId || null
    };
 
    const { error } = await runWithRetry<SupabaseWriteResult>(
      () => supabase
        .from('webhook_events')
        .insert(webhookEvent),
      { eventType, source, eventId: eventId || null },
    );
 
    if (error) {
      logger.error('Failed to log webhook event to database:', { 
        error: error.message,
        eventType,
        source 
      });
      throw new Error(`Webhook event log insert failed: ${error.message}`);
    } else {
      logger.debug('Webhook event logged successfully:', { 
        eventType, 
        source, 
        status,
        processed 
      });
    }

  } catch (error: any) {
    logger.error('Failed to log webhook event:', { 
      error: error.message,
      eventType,
      source 
    });
    throw error;
  }
}

// Update existing webhook event with processed status
export async function updateWebhookEventStatus(
  supabase: any,
  eventId: string,
  processed: boolean,
  errorMessage?: string
) {
  try {
    const now = new Date();
    let status = 'unknown';
    
    if (processed && !errorMessage) {
      status = 'processed';
    } else if (processed && errorMessage) {
      status = 'processed_with_warnings';
    } else if (!processed && errorMessage) {
      status = 'failed';
    }

    const { error } = await runWithRetry<SupabaseWriteResult>(
      () => supabase
        .from('webhook_events')
        .update({
          processed,
          status,
          error_message: errorMessage,
          processed_at: processed ? now.toISOString() : null,
          updated_at: now.toISOString()
        })
        .eq('id', eventId),
      { eventId, status },
    );

    if (error) {
      logger.error('Failed to update webhook event status:', { 
        error: error.message,
        eventId,
        status 
      });
      throw new Error(`Webhook event status update failed: ${error.message}`);
    }

  } catch (error: any) {
    logger.error('Failed to update webhook event status:', { 
      error: error.message,
      eventId 
    });
    throw error;
  }
}

// Webhook event status types for consistency
export type WebhookEventStatus = 
  | 'pending'
  | 'processed' 
  | 'failed'
  | 'processed_with_warnings'
  | 'unknown';

// Helper to get webhook processing time in seconds
export function getProcessingTimeSeconds(createdAt: string, processedAt: string | null): number | null {
  if (!processedAt) return null;
  
  try {
    const created = new Date(createdAt);
    const processed = new Date(processedAt);
    return (processed.getTime() - created.getTime()) / 1000;
  } catch {
    return null;
  }
}
