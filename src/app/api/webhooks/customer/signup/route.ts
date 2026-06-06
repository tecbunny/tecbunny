import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';

// Generic customer signup webhook handler
export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    const supabase = await createClient();
    body = await request.json();
    
    logger.info('Customer signup webhook received:', { body: JSON.stringify(body) });

    // Validate webhook signature if provided
    const signature = request.headers.get('x-webhook-signature');
    const source = request.headers.get('x-webhook-source') || 'unknown';
    
    if (!validateWebhookSignature(signature, body, source)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Process customer signup
    const result = await processCustomerSignup(supabase, body, source);
    
    // Log webhook event
    await logWebhookEvent(supabase, 'customer_signup', body, source, true);
    
    return NextResponse.json(result);

  } catch (error: any) {
    logger.error('Customer signup webhook error:', { error: error.message });
    
    // Log failed webhook event
    try {
      const supabase = await createClient();
      await logWebhookEvent(supabase, 'customer_signup', body, 'unknown', false, error.message);
    } catch (logError: any) {
      logger.error('Failed to log webhook error:', { error: logError.message });
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Process customer signup from various sources
async function processCustomerSignup(supabase: any, data: any, source: string) {
  const {
    phone_number,
    phone,
    mobile,
    customer_name,
    name,
    full_name,
    email,
    lead_source,
    source: dataSource,
    campaign,
    custom_fields,
    metadata,
    ...additionalData
  } = data;

  // Normalize phone number field
  const customerPhone = phone_number || phone || mobile;
  const customerName = customer_name || name || full_name || `Customer ${customerPhone?.slice(-4)}`;
  const customerEmail = email;
  const customerSource = lead_source || dataSource || source;

  if (!customerPhone) {
    throw new Error('Phone number is required for customer signup');
  }

  // Clean and format phone number
  const cleanPhone = customerPhone.replace(/[^\d]/g, '');
  const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  // Check if customer already exists
  const { data: existingCustomer, error: findError } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', formattedPhone)
    .single();

  if (findError && findError.code !== 'PGRST116') {
    throw findError;
  }

  let customerId;
  let actionTaken = 'updated';

  if (existingCustomer) {
    // Update existing customer
    const updateData: any = {
      last_contact_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update name if not previously set or if new name provided
    if (!existingCustomer.name || existingCustomer.name.startsWith('Customer ')) {
      updateData.name = customerName;
    }

    // Update email if provided and not previously set
    if (customerEmail && !existingCustomer.email) {
      updateData.email = customerEmail;
    }

    // Merge custom data
    if (custom_fields || metadata || Object.keys(additionalData).length > 0) {
      updateData.custom_data = {
        ...existingCustomer.custom_data,
        ...custom_fields,
        ...metadata,
        ...additionalData
      };
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', existingCustomer.id);

    if (updateError) throw updateError;
    customerId = existingCustomer.id;
    
    logger.info('Updated existing customer:', { customerId, phone: formattedPhone });
  } else {
    // Create new customer
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        phone: formattedPhone,
        name: customerName,
        email: customerEmail,
        lead_source: customerSource,
        first_contact_date: new Date().toISOString(),
        last_contact_date: new Date().toISOString(),
        status: 'new_lead',
        custom_data: {
          ...custom_fields,
          ...metadata,
          ...additionalData,
          original_source: source,
          campaign
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) throw createError;
    customerId = newCustomer.id;
    actionTaken = 'created';
    
    logger.info('Created new customer:', { customerId, phone: formattedPhone });

    // Send welcome WhatsApp message for new customers
    if (process.env.AUTO_WHATSAPP_WELCOME === 'true') {
      await sendWelcomeWhatsApp(formattedPhone, customerName, source);
    }
  }

  // Log the signup interaction
  await supabase
    .from('customer_interactions')
    .insert({
      customer_id: customerId,
      interaction_type: 'signup',
      direction: 'inbound',
      interaction_data: {
        source,
        campaign,
        signup_data: data,
        original_phone: customerPhone
      },
      created_at: new Date().toISOString()
    });

  // Send internal team notification
  if (process.env.TEAM_NOTIFICATION_ENABLED === 'true' && actionTaken === 'created') {
    await sendTeamNotification('customer_signup', {
      customer_id: customerId,
      phone: formattedPhone,
      name: customerName,
      source: customerSource,
      action: actionTaken
    });
  }

  return {
    success: true,
    customer_id: customerId,
    action: actionTaken,
    phone: formattedPhone,
    source: customerSource
  };
}

// Send welcome WhatsApp message
async function sendWelcomeWhatsApp(phoneNumber: string, customerName: string, source: string) {
  try {
    const welcomeMessage = `
🎉 Welcome to TecBunny Store! ${customerName ? `Hi ${customerName}!` : ''}

Thank you for joining our tech community! We're excited to help you find the perfect technology products.

🛍️ What we offer:
• Premium gaming peripherals
• Computer accessories  
• Audio & storage solutions
• Expert tech support

💬 Stay connected:
📱 WhatsApp support (this number)
🌐 Website: https://tecbunny.com
📞 Call: +91 96041 36010

🎁 New customer special: Use code WELCOME10 for 10% off your first order!

Happy shopping! 🚀
    `.trim();

    await sendWhatsAppNotification(phoneNumber, welcomeMessage);
    logger.info('Welcome WhatsApp sent:', { phoneNumber, source });
  } catch (error: any) {
    logger.error('Failed to send welcome WhatsApp:', { error: error.message });
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
🎯 New Customer Signup!

👤 Name: ${data.name}
📱 Phone: ${data.phone}
📊 Source: ${data.source}
🔧 Action: ${data.action}

Customer ID: ${data.customer_id}
Time: ${new Date().toLocaleString('en-IN')}

Follow up recommended! 📞
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

// Validate webhook signature
function validateWebhookSignature(signature: string | null, body: any, source: string): boolean {
  // Skip validation in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Implement signature validation based on source
  // Each webhook source should have its own validation logic
  
  if (!signature) {
    logger.warn('No webhook signature provided:', { source });
    return false;
  }

  // Add your signature validation logic here
  // Example: HMAC validation, JWT verification, etc.
  
  return true;
}

// Log webhook events for debugging and analytics
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


