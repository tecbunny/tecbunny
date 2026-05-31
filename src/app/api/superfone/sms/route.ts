import { NextRequest } from 'next/server';

import { superfoneAPI } from '@/lib/superfone-enterprise-api';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

// export const dynamic = 'force-dynamic';

/**
 * POST /api/superfone/sms
 * Send SMS message
 */
export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('UNAUTHORIZED', { correlationId });
    }

    const body = await request.json();
    const {
      to_number,
      message,
      template_id,
      sender_id,
      schedule_time,
      priority = 'normal'
    } = body;

    // Validate required fields
    if (!to_number || !message) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    // Normalize phone number
    const normalizedTo = to_number.startsWith('+') ? to_number : `+91${to_number}`;

    const smsData = {
      to_number: normalizedTo,
      message,
      template_id,
      sender_id,
      schedule_time,
      priority,
      custom_data: {
        user_id: user.id,
        sent_by: user.email,
        timestamp: new Date().toISOString()
      }
    };

    const result = await superfoneAPI.sendSMS(smsData);

    // Log message in database
    const { error: dbError } = await supabase
      .from('message_logs')
      .insert({
        message_id: result.message_id || result.id,
        type: 'sms',
        recipient: normalizedTo,
        status: schedule_time ? 'scheduled' : 'sent',
        user_id: user.id,
        content: message,
        template_id,
        scheduled_for: schedule_time,
        sent_at: schedule_time ? null : new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (dbError) {
      logger.error('Failed to log SMS message in database', { error: dbError, correlationId });
    }

    return apiSuccess({
      message_id: result.message_id || result.id,
      status: schedule_time ? 'scheduled' : 'sent',
      recipient: normalizedTo,
      scheduled_for: schedule_time,
      message: 'SMS sent successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error sending SMS', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
