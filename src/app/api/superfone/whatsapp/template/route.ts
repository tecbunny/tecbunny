import { NextRequest } from 'next/server';

import { superfoneService } from '../../../../../lib/superfone-service';
import { logger } from '../../../../../lib/logger';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { createClient } from '../../../../../lib/supabase/server';

// export const dynamic = 'force-dynamic';

/**
 * POST /api/superfone/whatsapp/template
 * Send WhatsApp template message
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
      template_name,
      language_code = 'en',
      recipient,
      components
    } = body;

    // Validate required fields
    if (!template_name || !recipient) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    // Normalize phone number
    const normalizedRecipient = recipient.startsWith('+') ? recipient : `+91${recipient}`;

    const result = await superfoneService.sendWhatsApp({
      type: 'template',
      templateName: template_name,
      language: language_code,
      recipient: normalizedRecipient,
      components
    });

    // Log message in database
    const { error: dbError } = await supabase
      .from('message_logs')
      .insert({
        message_id: result.message_id || result.data?.id,
        type: 'whatsapp_template',
        recipient: normalizedRecipient,
        template_name,
        status: 'sent',
        user_id: user.id,
        content: JSON.stringify({ template_name, components }),
        sent_at: new Date().toISOString()
      });

    if (dbError) {
      logger.error('Failed to log WhatsApp message in database', { error: dbError, correlationId });
    }

    return apiSuccess({
      message_id: result.message_id || result.data?.id,
      status: 'sent',
      recipient: normalizedRecipient,
      template_name,
      message: 'WhatsApp template sent successfully'
    }, correlationId);

  } catch (error: unknown) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error sending WhatsApp template', {
      error: error instanceof Error ? error.message : String(error),
      correlationId
    });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
