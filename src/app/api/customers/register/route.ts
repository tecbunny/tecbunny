import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWelcomeNotification, sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

interface CustomerRegistrationData {
  name: string;
  phone: string;
  email?: string;
  source?: string;
  lead_type?: string;
  tags?: string[];
  consent_whatsapp?: boolean;
}

// Customer registration with WhatsApp notifications
export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(clientIP, 'customer_registration', { limit: 3, windowMs: 60000 })) {
      return apiError('RATE_LIMITED', { correlationId });
    }

    const body: CustomerRegistrationData = await request.json();
    const { name, phone, email, source = 'website', tags = [], consent_whatsapp = true } = body;

    // Validate required fields
    if (!name || !phone) {
      return apiError('VALIDATION_ERROR', { 
        correlationId, 
        overrideMessage: 'Name and phone are required' 
      });
    }

    // Clean phone number (remove spaces, hyphens, etc.)
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    
    // Ensure phone starts with country code
    const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

    logger.info('customer_registration_attempt', {
      name,
      phone: formattedPhone,
      email,
      source,
      correlationId
    });

    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    let customer;
    let isNewCustomer = false;

    if (existingCustomer) {
      // Update existing customer
      const { data: updatedCustomer, error: updateError } = await supabase
        .from('customers')
        .update({
          name,
          email: email || existingCustomer.email,
          tags: [...new Set([...(existingCustomer.tags || []), ...tags])],
          last_contact_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id)
        .select()
        .single();

      if (updateError) {
        logger.error('customer_update_error', { error: updateError, correlationId });
        return apiError('DATABASE_ERROR', { correlationId });
      }

      customer = updatedCustomer;
      logger.info('customer_updated', { customerId: customer.id, correlationId });
    } else {
      // Create new customer
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
          name,
          phone: formattedPhone,
          email,
          status: 'active',
          lead_source: source,
          external_source: source,
          tags,
          consent_whatsapp,
          first_contact_date: new Date().toISOString(),
          last_contact_date: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        logger.error('customer_creation_error', { error: createError, correlationId });
        return apiError('DATABASE_ERROR', { correlationId });
      }

      customer = newCustomer;
      isNewCustomer = true;
      logger.info('customer_created', { customerId: customer.id, correlationId });
    }

    // Send WhatsApp notifications if consent given
    if (consent_whatsapp && formattedPhone) {
      try {
        if (isNewCustomer) {
          // Send welcome message to new customer
          await sendWelcomeNotification(formattedPhone, { customerName: name });
          logger.info('welcome_whatsapp_sent', { 
            customerId: customer.id, 
            phone: formattedPhone,
            correlationId 
          });
        }

        // Notify admin about new registration
        const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
        if (adminPhone) {
          const messageText = `🚨 *New Customer Registered* - TecBunny\n\n👤 *Name:* ${name}\n📞 *Phone:* ${formattedPhone}\n📧 *Email:* ${email || 'Not provided'}\n🌐 *Source:* ${source}`;
          await sendWhatsAppNotification(adminPhone, messageText);

          logger.info('admin_notification_sent', { 
            customerId: customer.id,
            adminPhone,
            correlationId 
          });
        }

        // Notify manager if different from admin
        const managerPhone = process.env.MANAGER_WHATSAPP_NUMBER;
        if (managerPhone && managerPhone !== adminPhone) {
          const messageText = `🚨 *New Customer Registered* - TecBunny\n\n👤 *Name:* ${name}\n📞 *Phone:* ${formattedPhone}\n📧 *Email:* ${email || 'Not provided'}\n🌐 *Source:* ${source}`;
          await sendWhatsAppNotification(managerPhone, messageText);

          logger.info('manager_notification_sent', { 
            customerId: customer.id,
            managerPhone,
            correlationId 
          });
        }

      } catch (whatsappError) {
        logger.warn('whatsapp_notification_failed', { 
          error: whatsappError,
          customerId: customer.id,
          correlationId 
        });
      }
    }

    return apiSuccess({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        status: customer.status,
        isNewCustomer
      }
    }, correlationId);

  } catch (error) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('customer_registration_error', { error, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

// Get customer by phone
export async function GET(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return apiError('VALIDATION_ERROR', { 
        correlationId, 
        overrideMessage: 'Phone parameter is required' 
      });
    }

    const supabase = await createClient();
    
    // Clean and format phone
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('customer_lookup_error', { error, phone: formattedPhone, correlationId });
      return apiError('DATABASE_ERROR', { correlationId });
    }

    if (!customer) {
      return NextResponse.json({
        success: false,
        error: 'Customer not found',
        customer: null
      }, { status: 404 });
    }

    return apiSuccess({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        status: customer.status,
        created_at: customer.created_at
      }
    }, correlationId);

  } catch (error) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('customer_lookup_error', { error, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
