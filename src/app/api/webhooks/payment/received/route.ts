import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';

import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';
import { validateWebhookSignature, validateWebhookTimestamp } from '@/lib/webhook-validator';
import { logWebhookEvent } from '@/lib/webhook-logger';
import { getRedis } from '@/lib/redis';

const deriveWebhookEventId = (source: string, rawBody: string, signature: string | null): string => {
  return crypto
    .createHash('sha256')
    .update(source)
    .update('\0')
    .update(signature ?? '')
    .update('\0')
    .update(rawBody)
    .digest('hex');
};

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
      logger.error('Failed to parse payment received webhook body', { error: e });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    logger.info('Payment received webhook received:', { body: JSON.stringify(body), correlationId });

    const signature = request.headers.get('x-webhook-signature');
    const source = request.headers.get('x-webhook-source') || 'unknown';
    const timestampStr = request.headers.get('x-webhook-timestamp') || request.headers.get('x-payu-timestamp');
    
    // Webhook Timestamp Validation
    if (timestampStr) {
      try {
        validateWebhookTimestamp(Number(timestampStr));
      } catch (err: any) {
        logger.error('Webhook timestamp validation failed:', { error: err.message });
        return NextResponse.json({ error: 'Timestamp verification failed' }, { status: 403 });
      }
    }
    
    const secret = source === 'razorpay'
      ? process.env.RAZORPAY_WEBHOOK_SECRET
      : process.env.TECBUNNY_WEBHOOK_SECRET;

    if (!validateWebhookSignature(signature, rawBody, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Idempotency: every signed request gets either the gateway event id or a stable body fingerprint.
    const eventId = body.id || body.event_id || body.payment_id || body.transaction_id || deriveWebhookEventId(source, rawBody, signature);
    const redis = getRedis();
    if (redis) {
      const idempotencyKey = `webhook:payment:received:${eventId}`;
      // Set key with 24h expiration, NX means only set if not exists.
      const isNewEvent = await redis.set(idempotencyKey, 'processing', 'EX', 86400, 'NX');

      if (!isNewEvent) {
        logger.info('Duplicate payment received webhook event (Redis cache hit), skipping execution', { eventId, correlationId });
        return NextResponse.json({ success: true, message: 'Event already processed (duplicate)' }, { status: 200 });
      }
    }

    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      logger.info('Duplicate payment received webhook event (DB hit), skipping execution', { eventId, correlationId });
      return NextResponse.json({ success: true, message: 'Event already processed (duplicate)' }, { status: 200 });
    }

    // Use Next.js after() to process the webhook asynchronously
    after(async () => {
      try {
        const backgroundSupabase = await createClient();
        await processPaymentReceived(backgroundSupabase, body, source);
        await logWebhookEvent(backgroundSupabase, 'payment_received', body, source, true, undefined, startTime, eventId);
      } catch (err: any) {
        logger.error('Background payment webhook processing error:', { error: err.message, correlationId });
      }
    });
    
    // Instantly return 200 OK
    return NextResponse.json({ success: true, message: 'Webhook queued' }, { status: 200 });

  } catch (error: any) {
    logger.error('Payment received webhook error:', { error: error.message, correlationId });
    
    try {
      const supabase = await createClient();
      let parsedBody = {};
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : {};
      } catch {}
      const signature = request.headers.get('x-webhook-signature');
      const source = request.headers.get('x-webhook-source') || 'unknown';
      const eventId = (parsedBody as any).id
        || (parsedBody as any).event_id
        || (parsedBody as any).payment_id
        || (parsedBody as any).transaction_id
        || deriveWebhookEventId(source, rawBody, signature);
      await logWebhookEvent(supabase, 'payment_received', parsedBody, 'unknown', false, error.message, startTime, eventId);
    } catch (logError: any) {
      logger.error('Failed to log webhook error:', { error: logError.message, correlationId });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const mapPaymentStatus = (status: string | undefined | null): 'approved' | 'failed' | 'pending' => {
  if (!status) return 'pending';
  const clean = status.trim().toLowerCase();
  
  if (['success', 'paid', 'approved', 'captured', 'completed', 'authorized', 'captured_success'].includes(clean)) {
    return 'approved';
  }
  
  if (['failed', 'failure', 'rejected', 'declined', 'cancelled', 'bounced'].includes(clean)) {
    return 'failed';
  }
  
  return 'pending';
};

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
  const systemPaymentStatus = mapPaymentStatus(payment_status);

  // Update order status based on payment outcome
  if (orderId) {
    const orderStatus = systemPaymentStatus === 'approved' ? 'Payment Confirmed' : 'Payment Failed';
    const { error: orderError, data: updatedOrder } = await supabase
      .from('orders')
      .update({
        payment_id: paymentId,
        payment_method,
        payment_date: payment_date || new Date().toISOString(),
        status: orderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (orderError) {
      logger.warn('Failed to update order payment status:', orderError);
    } else if (systemPaymentStatus === 'approved' && updatedOrder) {
      // Check if order has installation service and is eligible for free installation offer
      const orderItems = updatedOrder.items || [];
      let shouldUseSlot = false;
      let totalInstallationPrice = 0;

      // Scan order items for installation services
      if (Array.isArray(orderItems)) {
        orderItems.forEach((item: any) => {
          const itemName = item.name?.toLowerCase() || item.product_name?.toLowerCase() || '';
          const isInstallation = itemName.includes('installation') || itemName.includes('install');
          const price = item.sale_price || item.final_price || item.price || 0;
          
          if (isInstallation) {
            totalInstallationPrice = Math.max(totalInstallationPrice, price);
          }
        });
      }

      // If order has installation service within free offer range (≤ ₹2,499), use a slot
      if (totalInstallationPrice > 0 && totalInstallationPrice <= 2499) {
        shouldUseSlot = true;

        // Decrement free installation slot
        try {
          const slotResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/free-installation-slots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          const slotData = await slotResponse.json();
          
          if (slotData.success) {
            logger.info('Free installation slot decremented', { 
              orderId, 
              remainingSlots: slotData.remainingSlots,
              confirmedCount: slotData.confirmedCount 
            });
          } else {
            logger.warn('Failed to decrement free installation slot', { orderId, error: slotData.message });
          }
        } catch (slotError: any) {
          logger.error('Error calling free installation slots API', { orderId, error: slotError.message });
        }

        // Mark order as using free installation
        const { error: updateError } = await supabase
          .from('orders')
          .update({ used_free_installation: true })
          .eq('order_id', orderId);

        if (updateError) {
          logger.warn('Failed to update order free installation flag:', updateError);
        }
      }
    }
  }

  // Store payment record with mapped status
  const { error: paymentError } = await supabase
    .from('payments')
    .insert({
      payment_id: paymentId,
      order_id: orderId,
      customer_phone: formattedPhone,
      amount: paymentAmount,
      currency,
      payment_method,
      status: systemPaymentStatus,
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
