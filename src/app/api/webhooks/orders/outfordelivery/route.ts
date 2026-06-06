import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';

// Generic order out for delivery webhook handler
export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    const supabase = await createClient();
    body = await request.json();
    
    logger.info('Order out for delivery webhook received:', { body: JSON.stringify(body) });

    const signature = request.headers.get('x-webhook-signature');
    const source = request.headers.get('x-webhook-source') || 'unknown';
    
    if (!validateWebhookSignature(signature, body, source)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const result = await processOrderOutForDelivery(supabase, body, source);
    await logWebhookEvent(supabase, 'order_out_for_delivery', body, source, true);
    
    return NextResponse.json(result);

  } catch (error: any) {
    logger.error('Order out for delivery webhook error:', { error: error.message });
    
    try {
      const supabase = await createClient();
      await logWebhookEvent(supabase, 'order_out_for_delivery', body, 'unknown', false, error.message);
    } catch (logError: any) {
      logger.error('Failed to log webhook error:', { error: logError.message });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processOrderOutForDelivery(supabase: any, data: any, source: string) {
  const {
    order_id,
    order_number,
    customer_phone,
    customer_name,
    tracking_number,
    delivery_agent_name,
    delivery_agent_phone,
    estimated_delivery_time,
    delivery_window,
    delivery_address,
    delivery_instructions
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
      status: 'out_for_delivery',
      delivery_agent_name,
      delivery_agent_phone,
      estimated_delivery_time,
      delivery_window,
      out_for_delivery_at: new Date().toISOString(),
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
          interaction_type: 'order_out_for_delivery',
          direction: 'outbound',
          interaction_data: {
            order_id: orderId,
            tracking_number,
            delivery_agent_name,
            delivery_agent_phone,
            estimated_delivery_time,
            delivery_window,
            source
          },
          created_at: new Date().toISOString()
        });
    }
  }

  // Send delivery notification
  if (formattedPhone) {
    await sendOrderOutForDeliveryWhatsApp(formattedPhone, {
      orderId,
      customerName: customer_name,
      trackingNumber: tracking_number,
      deliveryAgentName: delivery_agent_name,
      deliveryAgentPhone: delivery_agent_phone,
      estimatedDeliveryTime: estimated_delivery_time,
      deliveryWindow: delivery_window,
      deliveryAddress: delivery_address,
      deliveryInstructions: delivery_instructions
    });
  }

  // Send team notification
  if (process.env.TEAM_NOTIFICATION_ENABLED === 'true') {
    await sendTeamNotification('order_out_for_delivery', {
      order_id: orderId,
      customer_name,
      phone: formattedPhone,
      tracking_number,
      delivery_agent_name,
      delivery_agent_phone,
      estimated_delivery_time,
      source
    });
  }

  return {
    success: true,
    order_id: orderId,
    phone: formattedPhone,
    tracking_number,
    delivery_agent_name,
    estimated_delivery_time,
    source
  };
}

async function sendOrderOutForDeliveryWhatsApp(phoneNumber: string, orderData: any) {
  try {
    const deliveryTime = orderData.estimatedDeliveryTime 
      ? `⏰ Expected: ${new Date(orderData.estimatedDeliveryTime).toLocaleString('en-IN')}`
      : orderData.deliveryWindow 
      ? `⏰ Window: ${orderData.deliveryWindow}`
      : '⏰ Today between 9 AM - 6 PM';

    const agentInfo = orderData.deliveryAgentName 
      ? `🚚 Delivery partner: ${orderData.deliveryAgentName}${orderData.deliveryAgentPhone ? ` (${orderData.deliveryAgentPhone})` : ''}`
      : '🚚 Our delivery partner will contact you';

    const message = `
🚚 Out for Delivery - TecBunny Store

${orderData.customerName ? `Hi ${orderData.customerName}! ` : ''}Your order is out for delivery! 📦✨

📦 Order: ${orderData.orderId}
${orderData.trackingNumber ? `📋 Tracking: ${orderData.trackingNumber}` : ''}
${deliveryTime}
${agentInfo}

${orderData.deliveryAddress ? `📍 Delivery to: ${orderData.deliveryAddress}` : ''}

📱 Important:
• Keep your phone handy - delivery partner may call
• Be available at the delivery address
• Have ID ready for verification
• Check package contents before accepting

${orderData.deliveryInstructions ? `📝 Special instructions: ${orderData.deliveryInstructions}` : ''}

🔄 Track live: Reply "TRACK" for real-time updates

Questions? Reply to this message or call +91 96041 36010

Almost there! Thank you for choosing TecBunny! 🎉
    `.trim();

    await sendWhatsAppNotification(phoneNumber, message);
    logger.info('Order out for delivery WhatsApp sent:', { 
      phoneNumber, 
      orderId: orderData.orderId,
      deliveryAgent: orderData.deliveryAgentName
    });
  } catch (error: any) {
    logger.error('Failed to send order out for delivery WhatsApp:', { error: error.message });
  }
}

async function sendTeamNotification(type: string, data: any) {
  try {
    const teamNumbers = [
      process.env.TEAM_WHATSAPP_1,
      process.env.TEAM_WHATSAPP_2
    ].filter(Boolean);

    const message = `
🚚 Order Out for Delivery!

📦 Order: ${data.order_id}
👤 Customer: ${data.customer_name || 'N/A'}
📱 Phone: ${data.phone || 'N/A'}
🚚 Tracking: ${data.tracking_number || 'N/A'}
👨‍🚚 Agent: ${data.delivery_agent_name || 'N/A'}
📞 Agent phone: ${data.delivery_agent_phone || 'N/A'}
⏰ Expected: ${data.estimated_delivery_time ? new Date(data.estimated_delivery_time).toLocaleString('en-IN') : 'TBD'}
🔗 Source: ${data.source}

Time: ${new Date().toLocaleString('en-IN')}
Status: Package is out for delivery! 🚛
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


