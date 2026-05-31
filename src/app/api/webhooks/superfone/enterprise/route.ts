import crypto from 'crypto';

import { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { SuperfoneWebhookPayload } from '@/lib/types/superfone';

// export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/superfone/enterprise
 * Enterprise Superfone webhook handler for all events
 */
export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify webhook signature
    const signature = request.headers.get('x-superfone-signature');
    const webhookSecret = process.env.SUPERFONE_WEBHOOK_SECRET;
    
    const body = await request.text();
    
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');
      
      if (`sha256=${expectedSignature}` !== signature) {
        logger.error('Invalid webhook signature', { correlationId });
        return apiError('UNAUTHORIZED', { correlationId });
      }
    }

    const payload: SuperfoneWebhookPayload = JSON.parse(body);
    
    logger.info('superfone_enterprise_webhook_received', {
      event_type: payload.event_type,
      webhook_id: payload.webhook_id,
      correlationId
    });

  const { event_type, data, event_id } = payload;

    // Log webhook event
    const { error: logError } = await supabase
      .from('webhook_logs')
      .insert({
        provider: 'superfone',
        event_type,
        event_id,
        payload,
        processed_at: new Date().toISOString(),
        correlation_id: correlationId
      });

    if (logError) {
      logger.error('Failed to log webhook event', { error: logError, correlationId });
    }

    // Route to appropriate handler based on event type
    switch (event_type) {
      case 'call.initiated':
        await handleCallInitiated(supabase, data, correlationId);
        break;
      
      case 'call.answered':
        await handleCallAnswered(supabase, data, correlationId);
        break;
      
      case 'call.ended':
        await handleCallEnded(supabase, data, correlationId);
        break;
      
      case 'call.missed':
        await handleCallMissed(supabase, data, correlationId);
        break;
      
      case 'call.recording.completed':
        await handleCallRecordingCompleted(supabase, data, correlationId);
        break;
      
      case 'call.transferred':
        await handleCallTransferred(supabase, data, correlationId);
        break;
      
      case 'message.received':
        await handleMessageReceived(supabase, data, correlationId);
        break;
      
      case 'message.sent':
        await handleMessageSent(supabase, data, correlationId);
        break;
      
      case 'sms.received':
        await handleSMSReceived(supabase, data, correlationId);
        break;
      
      case 'sms.sent':
        await handleSMSSent(supabase, data, correlationId);
        break;
      
      case 'contact.created':
        await handleContactCreated(supabase, data, correlationId);
        break;
      
      case 'lead.generated':
        await handleLeadGenerated(supabase, data, correlationId);
        break;
      
      default:
        logger.info('superfone_unhandled_event_type', { 
          event_type, 
          correlationId 
        });
    }

    return apiSuccess({ 
      message: 'Webhook processed successfully',
      event_type,
      event_id 
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('superfone_enterprise_webhook_error', { 
      error: error.message, 
      correlationId 
    });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

// =============================================================================
// CALL EVENT HANDLERS
// =============================================================================

async function handleCallInitiated(supabase: any, data: any, correlationId: string | null) {
  try {
    const { call_id, call_uuid, from_number, to_number, caller_id, call_start_time } = data;

    // Update or insert call log
    const { error } = await supabase
      .from('call_logs')
      .upsert({
        call_id,
        call_uuid,
        from_number,
        to_number,
        caller_id,
        status: 'initiated',
        direction: data.call_direction || 'outbound',
        start_time: call_start_time || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'call_id'
      });

    if (error) {
      logger.error('Failed to update call initiated', { error, correlationId });
    } else {
      logger.info('Call initiated logged', { call_id, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling call initiated', { error: error.message, correlationId });
  }
}

async function handleCallAnswered(supabase: any, data: any, correlationId: string | null) {
  try {
    const { call_id } = data;

    const { error } = await supabase
      .from('call_logs')
      .update({
        status: 'answered',
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('call_id', call_id);

    if (error) {
      logger.error('Failed to update call answered', { error, correlationId });
    } else {
      logger.info('Call answered logged', { call_id, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling call answered', { error: error.message, correlationId });
  }
}

async function handleCallEnded(supabase: any, data: any, correlationId: string | null) {
  try {
    const { call_id, call_duration, call_end_time, recording_url } = data;

    const { error } = await supabase
      .from('call_logs')
      .update({
        status: 'completed',
        duration: call_duration,
        end_time: call_end_time || new Date().toISOString(),
        recording_url,
        updated_at: new Date().toISOString()
      })
      .eq('call_id', call_id);

    if (error) {
      logger.error('Failed to update call ended', { error, correlationId });
    } else {
      logger.info('Call ended logged', { call_id, duration: call_duration, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling call ended', { error: error.message, correlationId });
  }
}

async function handleCallMissed(supabase: any, data: any, correlationId: string | null) {
  try {
    const { call_id, from_number, to_number } = data;

    // Update call log
    const { error: callError } = await supabase
      .from('call_logs')
      .update({
        status: 'missed',
        end_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('call_id', call_id);

    if (callError) {
      logger.error('Failed to update missed call', { error: callError, correlationId });
      return;
    }

    // Create missed call notification
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        type: 'missed_call',
        title: 'Missed Call',
        message: `Missed call from ${from_number}`,
        data: {
          call_id,
          from_number,
          to_number,
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      });

    if (notificationError) {
      logger.error('Failed to create missed call notification', { 
        error: notificationError, 
        correlationId 
      });
    }

    logger.info('Missed call processed', { call_id, from_number, correlationId });
  } catch (error: any) {
    logger.error('Error handling missed call', { error: error.message, correlationId });
  }
}

async function handleCallRecordingCompleted(supabase: any, data: any, correlationId: string | null) {
  try {
    const { call_id, recording_url, recording_duration } = data;

    const { error } = await supabase
      .from('call_logs')
      .update({
        recording_url,
        recording_duration,
        recording_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('call_id', call_id);

    if (error) {
      logger.error('Failed to update call recording', { error, correlationId });
    } else {
      logger.info('Call recording completed', { call_id, recording_url, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling call recording completed', { error: error.message, correlationId });
  }
}

async function handleCallTransferred(supabase: any, data: any, correlationId: string | null) {
  try {
    const { call_id, transferred_to, transferred_by, transfer_time } = data;

    const { error } = await supabase
      .from('call_logs')
      .update({
        transferred_to,
        transferred_by,
        transferred_at: transfer_time || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('call_id', call_id);

    if (error) {
      logger.error('Failed to update call transfer', { error, correlationId });
    } else {
      logger.info('Call transfer logged', { call_id, transferred_to, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling call transfer', { error: error.message, correlationId });
  }
}

// =============================================================================
// MESSAGE EVENT HANDLERS
// =============================================================================

async function handleMessageReceived(supabase: any, data: any, correlationId: string | null) {
  try {
    const { message_id, from_number, to_number, message_content, message_type, media_url } = data;

    // Log incoming message
    const { error } = await supabase
      .from('message_logs')
      .insert({
        message_id,
        type: `whatsapp_${message_type}`,
        sender: from_number,
        recipient: to_number,
        content: message_content,
        media_url,
        direction: 'inbound',
        status: 'received',
        received_at: new Date().toISOString()
      });

    if (error) {
      logger.error('Failed to log incoming message', { error, correlationId });
    } else {
      logger.info('Incoming message logged', { message_id, from_number, correlationId });
    }

    // Check for auto-reply rules or chatbot integration here
    // await processAutoReply(supabase, from_number, message_content);

  } catch (error: any) {
    logger.error('Error handling message received', { error: error.message, correlationId });
  }
}

async function handleMessageSent(supabase: any, data: any, correlationId: string | null) {
  try {
    const { message_id, to_number } = data;

    const { error } = await supabase
      .from('message_logs')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('message_id', message_id);

    if (error) {
      logger.error('Failed to update message sent status', { error, correlationId });
    } else {
      logger.info('Message sent status updated', { message_id, to_number, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling message sent', { error: error.message, correlationId });
  }
}

// =============================================================================
// SMS EVENT HANDLERS
// =============================================================================

async function handleSMSReceived(supabase: any, data: any, correlationId: string | null) {
  try {
    const { message_id, from_number, to_number, message_content } = data;

    const { error } = await supabase
      .from('message_logs')
      .insert({
        message_id,
        type: 'sms',
        sender: from_number,
        recipient: to_number,
        content: message_content,
        direction: 'inbound',
        status: 'received',
        received_at: new Date().toISOString()
      });

    if (error) {
      logger.error('Failed to log incoming SMS', { error, correlationId });
    } else {
      logger.info('Incoming SMS logged', { message_id, from_number, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling SMS received', { error: error.message, correlationId });
  }
}

async function handleSMSSent(supabase: any, data: any, correlationId: string | null) {
  try {
    const { message_id, to_number } = data;

    const { error } = await supabase
      .from('message_logs')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('message_id', message_id);

    if (error) {
      logger.error('Failed to update SMS sent status', { error, correlationId });
    } else {
      logger.info('SMS sent status updated', { message_id, to_number, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling SMS sent', { error: error.message, correlationId });
  }
}

// =============================================================================
// CONTACT & LEAD HANDLERS
// =============================================================================

async function handleContactCreated(supabase: any, data: any, correlationId: string | null) {
  try {
    const { contact_id, phone_number, name, email, custom_fields } = data;

    const { error } = await supabase
      .from('superfone_contacts')
      .upsert({
        superfone_contact_id: contact_id,
        phone_number,
        name,
        email,
        custom_fields,
        synced_at: new Date().toISOString()
      }, {
        onConflict: 'superfone_contact_id'
      });

    if (error) {
      logger.error('Failed to sync contact creation', { error, correlationId });
    } else {
      logger.info('Contact creation synced', { contact_id, phone_number, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling contact created', { error: error.message, correlationId });
  }
}

async function handleLeadGenerated(supabase: any, data: any, correlationId: string | null) {
  try {
    const { lead_id, phone_number, name, email, lead_source, lead_score, campaign_id } = data;

    const { error } = await supabase
      .from('leads')
      .insert({
        external_lead_id: lead_id,
        phone_number,
        name,
        email,
        source: lead_source,
        score: lead_score,
        campaign_id,
        provider: 'superfone',
        created_at: new Date().toISOString()
      });

    if (error) {
      logger.error('Failed to create lead from Superfone', { error, correlationId });
    } else {
      logger.info('Lead created from Superfone', { lead_id, phone_number, correlationId });
    }
  } catch (error: any) {
    logger.error('Error handling lead generated', { error: error.message, correlationId });
  }
}
