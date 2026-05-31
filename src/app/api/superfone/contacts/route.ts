import { NextRequest } from 'next/server';

import { superfoneAPI } from '../../../../lib/superfone-enterprise-api';
import { logger } from '../../../../lib/logger';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { createClient } from '../../../../lib/supabase/server';

// export const dynamic = 'force-dynamic';

/**
 * POST /api/superfone/contacts
 * Create or update contact
 */
export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('UNAUTHORIZED', { correlationId });
    }

    const body = await request.json();
    const {
      phone_number,
      name,
      email,
      company,
      tags,
      custom_fields,
      groups
    } = body;

    // Validate required fields
    if (!phone_number) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    // Normalize phone number
    const normalizedPhone = phone_number.startsWith('+') ? phone_number : `+91${phone_number}`;

    const contactData = {
      phone_number: normalizedPhone,
      name,
      email,
      company,
      tags,
      custom_fields: {
        ...custom_fields,
        created_by: user.id,
        created_by_email: user.email,
        created_at: new Date().toISOString()
      },
      groups
    };

    const result = await superfoneAPI.createContact(contactData);

    // Also create/update contact in local database
    const { error: dbError } = await supabase
      .from('superfone_contacts')
      .upsert({
        phone_number: normalizedPhone,
        name,
        email,
        company,
        tags,
        custom_fields: contactData.custom_fields,
        groups,
        superfone_contact_id: result.contact_id || result.id,
        user_id: user.id,
        synced_at: new Date().toISOString()
      }, {
        onConflict: 'phone_number'
      });

    if (dbError) {
      logger.error('Failed to sync contact to local database', { error: dbError, correlationId });
    }

    return apiSuccess({
      contact_id: result.contact_id || result.id,
      phone_number: normalizedPhone,
      name,
      email,
      message: 'Contact created/updated successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error creating/updating contact', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

/**
 * GET /api/superfone/contacts
 * Get contact by phone number
 */
export async function GET(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('UNAUTHORIZED', { correlationId });
    }

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone');

    if (!phoneNumber) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    const contact = await superfoneAPI.getContact(normalizedPhone);

    return apiSuccess({
      contact,
      message: 'Contact retrieved successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error getting contact', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
