import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '../../../../../lib/supabase/server';
import { sendWhatsAppNotification } from '../../../../../lib/whatsapp-service';
import { logger } from '../../../../../lib/logger';

// Generic order delivered webhook handler
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    logger.info('Order delivered webhook received:', { body: JSON.stringify(body) });

    const signature = request.headers.get('x-webhook-signature');
    const source = request.headers.get('x-webhook-source') || 'unknown';
    
    if (!validateWebhookSignature(signature, body, source)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const result = await processOrderDelivered(supabase, body, source);
    await logWebhookEvent(supabase, 'order_delivered', body, source, true);
    
    return NextResponse.json(result);

  } catch (error: unknown) {
    logger.error('Order delivered webhook error:', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    try {
      const supabase = await createClient();
      await logWebhookEvent(
        supabase,
        'order_delivered',
        await request.json(),
        'unknown',
        false,
        error instanceof Error ? error.message : String(error)
      );
    } catch (logError: unknown) {
      logger.error('Failed to log webhook error:', {
        error: logError instanceof Error ? logError.message : String(logError)
      });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processOrderDelivered(supabase: any, data: any, source: string) {
  const {
    order_id,
    order_number,
    customer_phone,
    customer_name,
    tracking_number,
    delivered_at,
    delivery_time,
    delivered_to,
  delivery_proof,
  delivery_photo,
    delivery_notes,
    feedback_url,
    review_url
  } = data;

  const orderId = order_id || order_number;
  const deliveryTimestamp = delivered_at || delivery_time || new Date().toISOString();

  if (!orderId) {
    throw new Error('Order ID is required');
  }

  const cleanPhone = customer_phone?.replace(/[^\d]/g, '');
  const formattedPhone = cleanPhone ? (cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`) : null;

  // Update order status
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'delivered',
      delivered_at: deliveryTimestamp,
      delivered_to,
      delivery_proof,
      delivery_notes,
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
          interaction_type: 'order_delivered',
          direction: 'outbound',
          interaction_data: {
            order_id: orderId,
            tracking_number,
            delivered_at: deliveryTimestamp,
            delivered_to,
            delivery_proof,
            delivery_notes,
            source
          },
          created_at: new Date().toISOString()
        });

      // Update customer stats
      await supabase
        .from('customers')
        .update({
          total_orders: customer.total_orders + 1,
          last_order_date: deliveryTimestamp
        })
        .eq('id', customer.id);
    }
  }

  // Send delivery confirmation
  if (formattedPhone) {
    await sendOrderDeliveredWhatsApp(formattedPhone, {
      orderId,
      customerName: customer_name,
      trackingNumber: tracking_number,
      deliveredAt: deliveryTimestamp,
      deliveredTo: delivered_to,
      deliveryProof: delivery_proof,
      deliveryPhoto: delivery_photo,
      deliveryNotes: delivery_notes,
      feedbackUrl: feedback_url,
      reviewUrl: review_url
    });
  }

  // Send team notification
  if (process.env.TEAM_NOTIFICATION_ENABLED === 'true') {
    await sendTeamNotification('order_delivered', {
      order_id: orderId,
      customer_name,
      phone: formattedPhone,
      tracking_number,
      delivered_at: deliveryTimestamp,
      delivered_to,
      source
    });
  }

  return {
    success: true,
    order_id: orderId,
    phone: formattedPhone,
    delivered_at: deliveryTimestamp,
    delivered_to,
    source
  };
}

async function sendOrderDeliveredWhatsApp(phoneNumber: string, orderData: any) {
  try {
    const deliveryTime = orderData.deliveredAt 
      ? new Date(orderData.deliveredAt).toLocaleString('en-IN')
      : 'Just now';

    const proofInfo = orderData.deliveryProof || orderData.deliveryPhoto 
      ? '📸 Delivery proof captured for your security'
      : '';

    const message = `
✅ Order Delivered - TecBunny Store

${orderData.customerName ? `Hi ${orderData.customerName}! ` : ''}Great news! Your order has been delivered successfully! 🎉📦

📦 Order: ${orderData.orderId}
${orderData.trackingNumber ? `📋 Tracking: ${orderData.trackingNumber}` : ''}
⏰ Delivered: ${deliveryTime}
${orderData.deliveredTo ? `👤 Received by: ${orderData.deliveredTo}` : ''}
${proofInfo}

${orderData.deliveryNotes ? `📝 Notes: ${orderData.deliveryNotes}` : ''}

🔍 Package Checklist:
• Verify all items are included
• Check for any damage
• Keep the invoice for warranty

💡 What's Next:
${orderData.reviewUrl ? `⭐ Share your experience: ${orderData.reviewUrl}` : '⭐ Rate us on Google Reviews'}
${orderData.feedbackUrl ? `📝 Give feedback: ${orderData.feedbackUrl}` : '📝 Reply with feedback about your experience'}

🎁 Happy with your purchase? 
Share it with friends and get ₹100 off your next order!

Need support? Reply to this message or call +91 96041 36010

Thank you for choosing TecBunny! 🚀
Come back soon for more amazing products! 🛒
    `.trim();

    await sendWhatsAppNotification(phoneNumber, message);
    logger.info('Order delivered WhatsApp sent:', { 
      phoneNumber, 
      orderId: orderData.orderId,
      deliveredAt: orderData.deliveredAt
    });

    // Send follow-up review request after 2 hours
    setTimeout(async () => {
      try {
        const followUpMessage = `
🌟 How was your TecBunny experience?

Hi! Hope you're enjoying your recent purchase (Order: ${orderData.orderId})! 

Your feedback helps us serve you better:

⭐⭐⭐⭐⭐ Rate us:
${orderData.reviewUrl || 'https://g.page/r/tecbunny/review'}

🎁 Bonus: Great reviews get special discounts!

Thank you! 🙏
- TecBunny Team
        `.trim();

        await sendWhatsAppNotification(phoneNumber, followUpMessage);
      } catch (error: any) {
        logger.error('Failed to send follow-up review request:', { error: error.message });
      }
    }, 2 * 60 * 60 * 1000); // 2 hours

  } catch (error: any) {
    logger.error('Failed to send order delivered WhatsApp:', { error: error.message });
  }
}

async function sendTeamNotification(type: string, data: any) {
  try {
    const teamNumbers = [
      process.env.TEAM_WHATSAPP_1,
      process.env.TEAM_WHATSAPP_2
    ].filter(Boolean);

    const message = `
✅ Order Delivered Successfully!

📦 Order: ${data.order_id}
👤 Customer: ${data.customer_name || 'N/A'}
📱 Phone: ${data.phone || 'N/A'}
🚚 Tracking: ${data.tracking_number || 'N/A'}
⏰ Delivered: ${data.delivered_at ? new Date(data.delivered_at).toLocaleString('en-IN') : 'Just now'}
👤 Received by: ${data.delivered_to || 'Customer'}
🔗 Source: ${data.source}

Time: ${new Date().toLocaleString('en-IN')}
Status: Order completed successfully! 🎉

Action: Follow up for review in 24 hours 📝
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


