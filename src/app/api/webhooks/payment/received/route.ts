import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';
import { validateWebhookSignature } from '@/lib/webhook-validator';
import { logWebhookEvent } from '@/lib/webhook-logger';

// Generic payment received webhook handler
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || null;
  const startTime = new Date();
  let rawBody = '';

  try {
    const supabase = await createClient();
    rawBody = await request.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    logger.info('Payment received webhook received:', { body: JSON.stringify(body), correlationId });

    const signature = request.headers.get('x-webhook-signature');
    const source = request.headers.get('x-webhook-source') || 'unknown';
    
    const secret = source === 'razorpay'
      ? process.env.RAZORPAY_WEBHOOK_SECRET
      : process.env.TECBUNNY_WEBHOOK_SECRET;

    if (!validateWebhookSignature(signature, rawBody, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Idempotency: Check if this event was already processed
    const eventId = body.id || body.event_id || body.payment_id || body.transaction_id;
    if (eventId) {
      const { data: existingEvent } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existingEvent) {
        logger.info('Duplicate payment received webhook event, skipping execution', { eventId, correlationId });
        return NextResponse.json({ success: true, message: 'Event already processed (duplicate)' });
      }
    }

    const result = await processPaymentReceived(supabase, body, source);
    await logWebhookEvent(supabase, 'payment_received', body, source, true, undefined, startTime, eventId);
    
    return NextResponse.json(result);

  } catch (error: any) {
    logger.error('Payment received webhook error:', { error: error.message, correlationId });
    
    try {
      const supabase = await createClient();
      let parsedBody = {};
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : {};
      } catch {}
      const eventId = (parsedBody as any).id || (parsedBody as any).event_id || (parsedBody as any).payment_id || (parsedBody as any).transaction_id;
      await logWebhookEvent(supabase, 'payment_received', parsedBody, 'unknown', false, error.message, startTime, eventId);
    } catch (logError: any) {
      logger.error('Failed to log webhook error:', { error: logError.message, correlationId });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processPaymentReceived(supabase: any, data: any, source: string) {
  const {
    payment_id,
    transaction_id,
    order_id,
    order_number,
    customer_phone,
    customer_name,
    amount,
    currency = 'INR',
    payment_method,
    payment_status = 'success',
    payment_date,
    gateway_response,
    metadata,
    ...additionalData
  } = data;

  const orderId = order_id || order_number;
  const paymentId = payment_id || transaction_id;

  if (!paymentId) {
    throw new Error('Payment ID is required');
  }

  const cleanPhone = customer_phone?.replace(/[^\d]/g, '');
  const formattedPhone = cleanPhone ? (cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`) : null;
  const paymentAmount = Number(amount ?? 0);

  // Update order status
  if (orderId) {
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        payment_id: paymentId,
        payment_method,
        payment_date: payment_date || new Date().toISOString(),
        status: 'Payment Confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (orderError) {
      logger.warn('Failed to update order payment status:', orderError);
    }
  }

  // Store payment record
  const { error: paymentError } = await supabase
    .from('payments')
    .insert({
      payment_id: paymentId,
      order_id: orderId,
      customer_phone: formattedPhone,
      amount: paymentAmount,
      currency,
      payment_method,
      status: payment_status,
      gateway_response,
      source,
      metadata: {
        ...metadata,
        ...additionalData
      },
      created_at: payment_date || new Date().toISOString()
    })
    .select()
    .single();

  if (paymentError && paymentError.code !== '23505') { // Ignore duplicate errors
    throw paymentError;
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
          interaction_type: 'payment_received',
          direction: 'inbound',
          interaction_data: {
            payment_id: paymentId,
            order_id: orderId,
            amount: paymentAmount,
            currency,
            payment_method,
            source
          },
          created_at: new Date().toISOString()
        });
    }
  }

  // Send payment confirmation WhatsApp
  if (formattedPhone) {
    await sendPaymentConfirmationWhatsApp(formattedPhone, {
      paymentId,
      orderId,
      amount: paymentAmount,
      currency,
      customerName: customer_name,
      paymentMethod: payment_method
    });
  }

  // Send team notification
  if (process.env.TEAM_NOTIFICATION_ENABLED === 'true') {
    await sendTeamNotification('payment_received', {
      payment_id: paymentId,
      order_id: orderId,
      customer_name,
      phone: formattedPhone,
      amount: paymentAmount,
      currency,
      payment_method,
      source
    });
  }

  return {
    success: true,
    payment_id: paymentId,
    order_id: orderId,
    amount: paymentAmount,
    currency,
    phone: formattedPhone,
    source
  };
}

async function sendPaymentConfirmationWhatsApp(phoneNumber: string, paymentData: any) {
  try {
    const message = `
✅ Payment Confirmed - TecBunny Store

💳 Payment ID: ${paymentData.paymentId}
📦 Order: ${paymentData.orderId || 'N/A'}
💰 Amount: ${paymentData.currency} ${paymentData.amount?.toLocaleString('en-IN')}
💳 Method: ${paymentData.paymentMethod || 'N/A'}

${paymentData.customerName ? `Hi ${paymentData.customerName}! ` : ''}Your payment has been successfully processed! 🎉

📦 Your order is now confirmed and will be processed within 24 hours.
📱 Track your order: https://www.tecbunny.com/orders/${paymentData.orderId || ''}

Thank you for shopping with TecBunny! 🚀
    `.trim();

    await sendWhatsAppNotification(phoneNumber, message);
    logger.info('Payment confirmation WhatsApp sent:', { 
      phoneNumber, 
      paymentId: paymentData.paymentId 
    });
  } catch (error: any) {
    logger.error('Failed to send payment confirmation WhatsApp:', { error: error.message });
  }
}

async function sendTeamNotification(type: string, data: any) {
  try {
    const teamNumbers = [
      process.env.TEAM_WHATSAPP_1,
      process.env.TEAM_WHATSAPP_2
    ].filter(Boolean);

    const message = `
💰 Payment Received!

💳 Payment: ${data.payment_id}
📦 Order: ${data.order_id || 'N/A'}
👤 Customer: ${data.customer_name || 'N/A'}
📱 Phone: ${data.phone || 'N/A'}
💰 Amount: ${data.currency} ${data.amount?.toLocaleString('en-IN')}
💳 Method: ${data.payment_method || 'N/A'}
🔗 Source: ${data.source}

Time: ${new Date().toLocaleString('en-IN')}
Action: Process order for fulfillment! 📦
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
