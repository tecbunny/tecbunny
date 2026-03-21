import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { logger } from '../../../../lib/logger';
import { sendAccountCreationConfirmationTemplate } from '../../../../lib/superfone-whatsapp-service';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const isSupabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      logger.error('first_login_whatsapp.supabase_config_missing');
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    let body: any;

    try {
      body = await request.json();
    } catch (error) {
      logger.warn('first_login_whatsapp.invalid_payload', { error: error instanceof Error ? error.message : error });
      return NextResponse.json({ success: false, error: 'Invalid request payload' }, { status: 400 });
    }

    const { userId, phone, name } = body || {};

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, mobile, first_login_whatsapp_sent, first_login_notified_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      logger.error('first_login_whatsapp.profile_lookup_failed', { userId, error: profileError });
      const httpStatus = profileError.code === 'PGRST116' ? 404 : 500;
      return NextResponse.json(
        { success: false, error: httpStatus === 404 ? 'Profile not found' : 'Failed to load profile' },
        { status: httpStatus }
      );
    }

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    if (profile.first_login_whatsapp_sent) {
      logger.info('first_login_whatsapp.already_sent', {
        userId,
        sentAt: profile.first_login_notified_at
      });

      return NextResponse.json({
        success: false,
        alreadySent: true,
        sentAt: profile.first_login_notified_at ?? null
      });
    }

    const targetPhone = (phone || profile.mobile || '').trim();

    if (!targetPhone) {
      logger.warn('first_login_whatsapp.missing_phone', { userId });
      return NextResponse.json({ success: false, error: 'No valid phone number available' }, { status: 400 });
    }

    const customerName = (name || profile.name || '').trim() || 'there';

    const sendResult = await sendAccountCreationConfirmationTemplate(targetPhone, customerName);

    if (!sendResult.success) {
      logger.error('first_login_whatsapp.delivery_failed', {
        userId,
        phone: targetPhone,
        error: sendResult.error
      });

      return NextResponse.json({
        success: false,
        error: sendResult.error || 'Failed to send WhatsApp message',
        messageId: sendResult.messageId ?? null
      });
    }

    const notifiedAt = new Date().toISOString();
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ first_login_whatsapp_sent: true, first_login_notified_at: notifiedAt })
      .eq('id', userId)
      .select('first_login_notified_at')
      .single();

    if (updateError) {
      logger.error('first_login_whatsapp.update_failed', {
        userId,
        error: updateError,
        messageId: sendResult.messageId
      });

      return NextResponse.json({
        success: true,
        warning: 'Message sent but failed to update profile flag',
        sentAt: notifiedAt,
        messageId: sendResult.messageId
      });
    }

    const sentAt = updatedProfile?.first_login_notified_at ?? notifiedAt;

    logger.info('first_login_whatsapp.sent', {
      userId,
      phone: targetPhone,
      messageId: sendResult.messageId,
      sentAt
    });

    return NextResponse.json({
      success: true,
      sentAt,
      messageId: sendResult.messageId
    });
  } catch (error) {
    logger.error('first_login_whatsapp.unexpected_error', { error });
    return NextResponse.json({ success: false, error: 'Unexpected server error' }, { status: 500 });
  }
}
