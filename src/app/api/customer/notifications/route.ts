import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { sendOrderNotification, sendOrderStatusUpdate, sendPaymentReminder } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';

// Customer signup integration with phone contact and WhatsApp notifications
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { action, customerData, orderData } = await request.json();

    switch (action) {
      case 'customer_signup':
        return await handleCustomerSignup(supabase, customerData);
      
      case 'order_confirmation':
        return await handleOrderConfirmation(supabase, orderData);
      
      case 'order_status_update':
        return await handleOrderStatusUpdate(supabase, orderData);
      
      case 'payment_reminder':
        return await handlePaymentReminder(supabase, orderData);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('customer_notification_error', { error });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// Handle customer signup from phone contact
async function handleCustomerSignup(supabase: any, customerData: any) {
  const { phone, name, email, source = 'website' } = customerData;

  // Check if customer already exists
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existingCustomer) {
    return NextResponse.json({ 
      status: 'exists', 
      customer_id: existingCustomer.id,
      message: 'Customer already exists'
    });
  }

  // Create new customer
  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert({
      phone,
      name,
      email,
      lead_source: source,
      first_contact_date: new Date().toISOString(),
      status: 'new_customer'
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Send welcome WhatsApp message
  await sendWelcomeMessage(phone, name);

  // Log signup interaction
  await supabase
    .from('customer_interactions')
    .insert({
      customer_id: newCustomer.id,
      interaction_type: 'signup',
      direction: 'system',
      interaction_data: {
        source,
        signup_method: 'phone_contact'
      }
    });

  return NextResponse.json({
    status: 'created',
    customer_id: newCustomer.id,
    message: 'Customer created successfully'
  });
}

// Handle order confirmation notifications
async function handleOrderConfirmation(supabase: any, orderData: any) {
  const { customer_phone, order_number, amount, items } = orderData;

  // Send WhatsApp order confirmation template
  await sendOrderNotification(customer_phone, {
    orderNumber: order_number,
  });

  // Send a richer follow-up text with full order details (amount + item list)
  if (amount || (Array.isArray(items) && items.length > 0)) {
    const itemLines = Array.isArray(items)
      ? items.slice(0, 5).map((i: any) => `• ${i.name ?? i.title ?? 'Item'} × ${i.quantity ?? 1}`).join('\n')
      : '';
    const moreCount = Array.isArray(items) && items.length > 5 ? `\n...and ${items.length - 5} more` : '';
    const amountLine = amount ? `\n💰 Total: ₹${amount}` : '';
    const detailMsg = `📋 Order #${order_number} Details${amountLine}${itemLines ? `\n\n${itemLines}${moreCount}` : ''}`.trim();
    await (await import('@/lib/whatsapp-service')).sendWhatsAppNotification(customer_phone, detailMsg);
  }

  // Log the notification
  await supabase
    .from('whatsapp_messages')
    .insert({
      phone_number: customer_phone,
      message_type: 'order_confirmation',
      direction: 'outbound',
      content: `Order confirmation sent for ${order_number}`,
      message_status: 'sent'
    });

  return NextResponse.json({ status: 'notification_sent' });
}

// Handle order status updates
async function handleOrderStatusUpdate(supabase: any, orderData: any) {
  const { 
    customer_phone, 
    order_number, 
    status, 
    tracking_number, 
    estimated_delivery 
  } = orderData;

  // Send WhatsApp status update
  await sendOrderStatusUpdate(customer_phone, {
    orderNumber: order_number,
    status,
    trackingNumber: tracking_number,
    estimatedDelivery: estimated_delivery
  });

  // Log the notification
  await supabase
    .from('whatsapp_messages')
    .insert({
      phone_number: customer_phone,
      message_type: 'order_update',
      direction: 'outbound',
      content: `Order status update: ${status}`,
      message_status: 'sent'
    });

  return NextResponse.json({ status: 'update_sent' });
}

// Handle payment reminders
async function handlePaymentReminder(supabase: any, orderData: any) {
  const { customer_phone, order_number, amount, payment_link } = orderData;

  // Send WhatsApp payment reminder
  await sendPaymentReminder(customer_phone, {
    orderNumber: order_number,
    amount,
    paymentLink: payment_link
  });

  // Log the notification
  await supabase
    .from('whatsapp_messages')
    .insert({
      phone_number: customer_phone,
      message_type: 'payment_reminder',
      direction: 'outbound',
      content: `Payment reminder sent for ${order_number}`,
      message_status: 'sent'
    });

  return NextResponse.json({ status: 'reminder_sent' });
}

// Send welcome message to new customers
async function sendWelcomeMessage(phone: string, name?: string) {
  const welcomeMessage = `
🎉 Welcome to TecBunny Store! ${name ? `Hi ${name}!` : ''}

Thank you for joining our tech community! 🚀

🛍️ What we offer:
• Premium gaming peripherals
• Computer accessories  
• Audio & storage solutions
• Expert tech support

💬 Stay connected:
📱 WhatsApp support (this number)
🌐 Website: https://tecbunny.com
📞 Call: +91 96041 36010

🎁 First-time buyer? Use code WELCOME10 for 10% off your first order!

Happy shopping! 😊
  `.trim();

  const { sendWhatsAppNotification } = await import('@/lib/whatsapp-service');
  return sendWhatsAppNotification(phone, welcomeMessage);
}
