import { NextRequest } from 'next/server';

import { superfoneService } from '@/lib/superfone-service';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

// export const dynamic = 'force-dynamic';

/**
 * POST /api/superfone/calls
 * Initiate an outbound call
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
      from_number,
      to_number,
      caller_id,
      recording_enabled = true,
      custom_data
    } = body;

    // Validate required fields
    if (!from_number || !to_number) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    // Add webhook URL for call status updates
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/superfone/calls`;

    const callData = {
      from_number,
      to_number,
      caller_id,
      recording_enabled,
      webhook_url: webhookUrl,
      custom_data: {
        ...custom_data,
        user_id: user.id,
        initiated_by: user.email,
        timestamp: new Date().toISOString()
      }
    };

    const result = await superfoneService.makeCall(callData);

    if (result.success) {
      // Log call initiation in database
        const { error: dbError } = await supabase
        .from('call_logs')
        .insert({
          call_id: result.call_id,
          call_uuid: result.data?.call_uuid || result.call_id,
          from_number,
          to_number,
          caller_id,
          status: 'initiated',
          user_id: user.id,
          recording_enabled,
          custom_data: callData.custom_data
        });      if (dbError) {
        logger.error('Failed to log call in database', { error: dbError, correlationId });
      }

      return apiSuccess({
        call_id: result.call_id,
        call_uuid: result.data?.call_uuid || result.call_id,
        status: result.data?.status || 'initiated',
        message: 'Call initiated successfully'
      }, correlationId);
    } else {
      return apiError('EXTERNAL_SERVICE_ERROR', { correlationId });
    }

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error initiating call', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

/**
 * GET /api/superfone/calls?callId=...
 * Get call status
 */
export async function GET(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('UNAUTHORIZED', { correlationId });
    }

    const url = new URL(request.url);
    const callId = url.searchParams.get('callId') || '';

    if (!callId) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    const callStatusResult = await superfoneService.getCallStatus(callId);
    
    if (!callStatusResult.success) {
      return apiError('EXTERNAL_SERVICE_ERROR', { correlationId });
    }
    
    const callStatus = callStatusResult.data;

    // Update call status in database
    const { error: dbError } = await supabase
      .from('call_logs')
      .update({
        status: callStatus.status,
        duration: callStatus.duration,
        end_time: callStatus.end_time,
        recording_url: callStatus.recording_url,
        updated_at: new Date().toISOString()
      })
      .eq('call_id', callId);

    if (dbError) {
      logger.error('Failed to update call status in database', { error: dbError, correlationId });
    }

    return apiSuccess(callStatus, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error getting call status', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
