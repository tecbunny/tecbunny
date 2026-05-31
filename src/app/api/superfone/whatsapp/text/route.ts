import { NextRequest } from 'next/server';

import { superfoneAPI } from '@/lib/superfone-enterprise-api';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

// export const dynamic = 'force-dynamic';

/**
 * POST /api/superfone/whatsapp/text
 * Send WhatsApp text message
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
    const { to, message } = body;

    // Validate required fields
    if (!to || !message) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    // Normalize phone number
    const normalizedTo = to.startsWith('+') ? to : `+91${to}`;

    const result = await superfoneAPI.sendWhatsAppText(normalizedTo, message);

    // Log message in database
    const { error: dbError } = await supabase
      .from('message_logs')
      .insert({
        message_id: result.message_id || result.id,
        type: 'whatsapp_text',
        recipient: normalizedTo,
        status: 'sent',
        user_id: user.id,
        content: message,
        sent_at: new Date().toISOString()
      });

    if (dbError) {
      logger.error('Failed to log WhatsApp text message in database', { error: dbError, correlationId });
    }

    return apiSuccess({
      message_id: result.message_id || result.id,
      status: 'sent',
      recipient: normalizedTo,
      message: 'WhatsApp text message sent successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error sending WhatsApp text message', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

/**
 * GET /api/superfone/whatsapp/text
 * Get WhatsApp templates
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

    const templates = await superfoneAPI.getWhatsAppTemplates();

    return apiSuccess({
      templates,
      message: 'WhatsApp templates retrieved successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error getting WhatsApp templates', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
