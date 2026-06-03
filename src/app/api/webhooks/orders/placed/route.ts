import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { sendOrderNotification, sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';
import { validateWebhookSignature } from '@/lib/webhook-validator';
import { logWebhookEvent } from '@/lib/webhook-logger';

// Generic order placed webhook handler
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
      logger.error('Failed to parse order placed webhook body', { error: e });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    logger.info('Order placed webhook received:', { body: JSON.stringify(body), correlationId });

    // Validate webhook signature
    const signature = request.headers.get('x-webhook-signature');
    const source = request.headers.get('x-webhook-source') || 'unknown';
    
    const secret = source === 'razorpay'
      ? process.env.RAZORPAY_WEBHOOK_SECRET
      : process.env.TECBUNNY_WEBHOOK_SECRET;

    if (!validateWebhookSignature(signature, rawBody, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Idempotency: Check if this event was already processed
    const eventId = body.id || body.event_id || body.order_id || body.order_number;
    if (eventId) {
      const { data: existingEvent } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existingEvent) {
        logger.info('Duplicate order placed webhook event received, skipping execution', { eventId, correlationId });
        return NextResponse.json({ success: true, message: 'Event already processed (duplicate)' });
      }
    }

    // Process order placement
    const result = await processOrderPlaced(supabase, body, source);
    
    // Log webhook event
    await logWebhookEvent(supabase, 'order_placed', body, source, true, undefined, startTime, eventId);
    
    return NextResponse.json(result);

  } catch (error: any) {
    logger.error('Order placed webhook error:', { error: error.message, correlationId });
    
    // Log failed webhook event
    try {
      const supabase = await createClient();
      let parsedBody = {};
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : {};
      } catch {}
      const eventId = (parsedBody as any).id || (parsedBody as any).event_id || (parsedBody as any).order_id || (parsedBody as any).order_number;
      await logWebhookEvent(supabase, 'order_placed', parsedBody, 'unknown', false, error.message, startTime, eventId);
    } catch (logError: any) {
      logger.error('Failed to log webhook error:', { error: logError.message, correlationId });
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Process order placed from various sources
async function processOrderPlaced(supabase: any, data: any, source: string) {
  const {
    order_id,
    order_number,
    order_ref,
    customer_phone,
    customer_mobile,
    phone,
    customer_name,
    customer_email,
    total_amount,
    amount,
    order_total,
    currency = 'INR',
    items,
    products,
    line_items,
    shipping_address,
    billing_address,
    payment_method,
    order_date,
    created_at,
    metadata,
    custom_fields,
    ...additionalData
  } = data;

  // Normalize fields
  const orderId = order_id || order_number || order_ref;
  const customerPhone = customer_phone || customer_mobile || phone;
  const customerName = customer_name;
  const customerEmail = customer_email;
  const orderAmountRaw = total_amount ?? amount ?? order_total;
  const orderAmount = Number(orderAmountRaw ?? 0);
  const orderItems = items || products || line_items || [];
  const orderDate = order_date || created_at || new Date().toISOString();

  if (!orderId) {
    throw new Error('Order ID is required');
  }

  if (!customerPhone) {
    throw new Error('Customer phone is required');
  }

  // Clean and format phone number
  const cleanPhone = customerPhone.replace(/[^\d]/g, '');
  const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  // Find or create customer
  let customerId;
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', formattedPhone)
    .single();

  if (existingCustomer) {
    customerId = existingCustomer.id;
    
    // Update customer info if new data provided
    const updateData: any = {
      last_contact_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (customerName && (!existingCustomer.name || existingCustomer.name.startsWith('Customer '))) {
      updateData.name = customerName;
    }

    if (customerEmail && !existingCustomer.email) {
      updateData.email = customerEmail;
    }

    await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customerId);
  } else {
    // Create new customer
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        phone: formattedPhone,
        name: customerName || `Customer ${cleanPhone.slice(-4)}`,
        email: customerEmail,
        lead_source: 'order',
        first_contact_date: new Date().toISOString(),
        last_contact_date: new Date().toISOString(),
        status: 'customer',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) throw createError;
    customerId = newCustomer.id;
  }

  // Store order information
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      id: orderId,
      customer_id: customerId,
      customer_phone: formattedPhone,
      customer_name: customerName,
      customer_email: customerEmail,
      total: orderAmount,
      currency,
      status: 'Awaiting Payment',
      order_data: {
        items: orderItems,
        shipping_address,
        billing_address,
        payment_method,
        source,
        metadata,
        custom_fields,
        ...additionalData
      },
      created_at: orderDate
    })
    .select()
    .single();

  if (orderError) {
    // If order already exists, update it
    if (orderError.code === '23505') { // Unique constraint violation
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'Awaiting Payment',
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId);

      if (updateError) throw updateError;
    } else {
      throw orderError;
    }
  }

  // Log the order interaction
  await supabase
    .from('customer_interactions')
    .insert({
      customer_id: customerId,
      interaction_type: 'order_placed',
      direction: 'inbound',
      interaction_data: {
        order_id: orderId,
        amount: orderAmount,
        items_count: orderItems.length,
        source,
        payment_method
      },
      created_at: new Date().toISOString()
    });

  // Send order confirmation WhatsApp
  if (formattedPhone && orderItems.length > 0) {
    await sendOrderConfirmationWhatsApp(formattedPhone, {
      orderNumber: orderId,
      amount: orderAmount,
      currency,
      items: orderItems.map((item: any) => 
        item.name || item.title || item.product_name || `${item.quantity || 1}x Product`
      ),
      customerName
    });
  }

  // Send team notification
  if (process.env.TEAM_NOTIFICATION_ENABLED === 'true') {
    await sendTeamNotification('order_placed', {
      order_id: orderId,
      customer_name: customerName,
      phone: formattedPhone,
      amount: orderAmount,
      currency,
      items_count: orderItems.length,
      source
    });
  }

  return {
    success: true,
    order_id: orderId,
    customer_id: customerId,
    amount: orderAmount,
    items_count: orderItems.length,
    phone: formattedPhone,
    source
  };
}

// Send order confirmation WhatsApp
async function sendOrderConfirmationWhatsApp(phoneNumber: string, orderData: any) {
  try {
    await sendOrderNotification(phoneNumber, orderData);
    logger.info('Order confirmation WhatsApp sent:', { 
      phoneNumber, 
      orderNumber: orderData.orderNumber 
    });
  } catch (error: any) {
    logger.error('Failed to send order confirmation WhatsApp:', { error: error.message });
  }
}

// Send team notifications
async function sendTeamNotification(type: string, data: any) {
  try {
    const teamNumbers = [
      process.env.TEAM_WHATSAPP_1,
      process.env.TEAM_WHATSAPP_2
    ].filter(Boolean);

    const message = `
🛒 New Order Placed!

📦 Order: ${data.order_id}
👤 Customer: ${data.customer_name}
📱 Phone: ${data.phone}
💰 Amount: ${data.currency} ${data.amount?.toLocaleString('en-IN')}
📊 Items: ${data.items_count}
🔗 Source: ${data.source}

Time: ${new Date().toLocaleString('en-IN')}
Action: Process order! 📋
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


