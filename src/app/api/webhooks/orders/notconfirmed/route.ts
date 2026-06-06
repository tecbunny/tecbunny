import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';

// Generic order not confirmed webhook handler
export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    const supabase = await createClient();
    body = await request.json();
    
    logger.info('Order not confirmed webhook received:', { body: JSON.stringify(body) });

    const signature = request.headers.get('x-webhook-signature');
    const source = request.headers.get('x-webhook-source') || 'unknown';
    
    if (!validateWebhookSignature(signature, body, source)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const result = await processOrderNotConfirmed(supabase, body, source);
    await logWebhookEvent(supabase, 'order_not_confirmed', body, source, true);
    
    return NextResponse.json(result);

  } catch (error: any) {
    logger.error('Order not confirmed webhook error:', { error: error.message });
    
    try {
      const supabase = await createClient();
      await logWebhookEvent(supabase, 'order_not_confirmed', body, 'unknown', false, error.message);
    } catch (logError: any) {
      logger.error('Failed to log webhook error:', { error: logError.message });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processOrderNotConfirmed(supabase: any, data: any, source: string) {
  const {
    order_id,
    order_number,
    customer_phone,
    customer_name,
    reason,
    pending_since,
    retry_url,
    payment_url
  } = data;

  const orderId = order_id || order_number;

  if (!orderId) {
    throw new Error('Order ID is required');
  }

  const cleanPhone = customer_phone?.replace(/[^\d]/g, '');
  const formattedPhone = cleanPhone ? (cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`) : null;

  // Update order status
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'pending_confirmation',
      pending_reason: reason,
      pending_since: pending_since || new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('order_id', orderId);

  if (orderError) {
    logger.warn('Failed to update order status:', orderError);
  }

  // Find customer and log interaction
  if (formattedPhone) {
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    if (customer) {
      await supabase
        .from('customer_interactions')
        .insert({
          customer_id: customer.id,
          interaction_type: 'order_not_confirmed',
          direction: 'system',
          interaction_data: {
            order_id: orderId,
            reason,
            pending_since,
            retry_url,
            payment_url,
            source
          },
          created_at: new Date().toISOString()
        });
    }
  }

  // Send reminder notification
  if (formattedPhone) {
    await sendOrderConfirmationReminderWhatsApp(formattedPhone, {
      orderId,
      customerName: customer_name,
      reason,
      retryUrl: retry_url,
      paymentUrl: payment_url
    });
  }

  // Send team notification
  if (process.env.TEAM_NOTIFICATION_ENABLED === 'true') {
    await sendTeamNotification('order_not_confirmed', {
      order_id: orderId,
      customer_name,
      phone: formattedPhone,
      reason,
      pending_since,
      source
    });
  }

  return {
    success: true,
    order_id: orderId,
    phone: formattedPhone,
    reason,
    source
  };
}

async function sendOrderConfirmationReminderWhatsApp(phoneNumber: string, orderData: any) {
  try {
    const message = `
⏰ Order Confirmation Reminder - TecBunny Store

📦 Order: ${orderData.orderId}
${orderData.customerName ? `Hi ${orderData.customerName}, ` : ''}

Your order is waiting for confirmation.

${orderData.reason ? `📝 Reason: ${orderData.reason}` : ''}

🔥 Don't miss out! Complete your order now:

${orderData.paymentUrl ? `💳 Complete payment: ${orderData.paymentUrl}` : 
  orderData.retryUrl ? `🔄 Confirm order: ${orderData.retryUrl}` : 
  '🛒 Visit: https://tecbunny.com/checkout'}

⚡ Limited time offer - confirm within 24 hours to avoid cancellation.

Need help? Reply to this message or call +91 96041 36010

Complete your TecBunny purchase today! 🚀
    `.trim();

    await sendWhatsAppNotification(phoneNumber, message);
    logger.info('Order confirmation reminder WhatsApp sent:', { 
      phoneNumber, 
      orderId: orderData.orderId 
    });
  } catch (error: any) {
    logger.error('Failed to send order confirmation reminder WhatsApp:', { error: error.message });
  }
}

async function sendTeamNotification(type: string, data: any) {
  try {
    const teamNumbers = [
      process.env.TEAM_WHATSAPP_1,
      process.env.TEAM_WHATSAPP_2
    ].filter(Boolean);

    const message = `
⚠️ Order Not Confirmed Alert!

📦 Order: ${data.order_id}
👤 Customer: ${data.customer_name || 'N/A'}
📱 Phone: ${data.phone || 'N/A'}
📝 Reason: ${data.reason || 'Not specified'}
⏰ Pending since: ${data.pending_since ? new Date(data.pending_since).toLocaleString('en-IN') : 'Unknown'}
🔗 Source: ${data.source}

Time: ${new Date().toLocaleString('en-IN')}
Action: Follow up with customer for confirmation! 📞
    `.trim();

    for (const number of teamNumbers) {
      if (number) {
        await sendWhatsAppNotification(number, message);
      }
    }
  } catch (error: any) {
    logger.error('Failed to send team notification:', { error: error.message });
  }
}

function validateWebhookSignature(signature: string | null, body: any, source: string): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!signature) {
    logger.warn('No webhook signature provided:', { source });
    return false;
  }

  return true;
}

async function logWebhookEvent(
  supabase: any, 
  eventType: string, 
  payload: any, 
  source: string, 
  processed: boolean, 
  errorMessage?: string
) {
  try {
    await supabase
      .from('webhook_events')
      .insert({
        source,
        event_type: eventType,
        payload,
        processed,
        error_message: errorMessage,
        created_at: new Date().toISOString()
      });
  } catch (error: any) {
    logger.error('Failed to log webhook event:', { error: error.message });
  }
}


