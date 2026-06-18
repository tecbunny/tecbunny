import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { logger } from '@/lib/logger';
import { sendWelcomeNotification } from '@/lib/whatsapp-service';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number and one special character';

function isStrongPassword(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value);
}

// Use admin client for user operations
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('complete_signup.configuration_missing');
      return NextResponse.json(
        { error: 'Service configuration error. Please contact support.' },
        { status: 503 }
      );
    }
    logger.info('complete_signup.start');
      
    const { email, password, name, mobile, otpId } = await request.json();

    // Validate required fields
    if (!password || !name || !mobile) {
      return NextResponse.json(
        { error: 'Mobile, password, and name are required' },
        { status: 400 }
      );
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { error: PASSWORD_POLICY_MESSAGE },
        { status: 400 }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (!otpId) {
      return NextResponse.json(
        { error: 'OTP transaction token reference (otpId) is required' },
        { status: 400 }
      );
    }

    // Query OTP verification database record to establish session legitimacy
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('otp_verifications')
      .select('*')
      .eq('id', otpId)
      .single();

    if (otpError || !otpRecord) {
      logger.error('complete_signup.otp_lookup_failed', { error: otpError, otpId });
      return NextResponse.json(
        { error: 'Invalid or missing OTP transaction reference' },
        { status: 400 }
      );
    }

    if (!otpRecord.verified) {
      logger.warn('complete_signup.otp_unverified', { otpId });
      return NextResponse.json(
        { error: 'OTP has not been verified yet' },
        { status: 400 }
      );
    }

    // Verify OTP record binds cleanly to the registration identifiers
    const normalizedMobile = String(mobile).replace(/\D/g, '');
    const otpPhoneClean = otpRecord.phone ? String(otpRecord.phone).replace(/\D/g, '') : '';
    
    const isPhoneMatch = otpPhoneClean === normalizedMobile;
    const isEmailMatch = email && otpRecord.email && otpRecord.email.trim().toLowerCase() === email.trim().toLowerCase();

    if (!isPhoneMatch && (!email || !isEmailMatch)) {
      logger.warn('complete_signup.otp_identifier_mismatch', {
        otpId,
        requestMobile: normalizedMobile,
        otpPhone: otpPhoneClean,
        requestEmail: email,
        otpEmail: otpRecord.email
      });
      return NextResponse.json(
        { error: 'OTP details do not match the signup identifiers' },
        { status: 400 }
      );
    }

    // Check expiration timeline (verified within last 15 minutes)
    const verifiedAt = otpRecord.verified_at ? new Date(otpRecord.verified_at).getTime() : 0;
    if (Date.now() - verifiedAt > 15 * 60 * 1000) {
      logger.warn('complete_signup.otp_session_expired', { otpId });
      return NextResponse.json(
        { error: 'OTP verification session has expired. Please verify again.' },
        { status: 400 }
      );
    }

    // Atomically consume the verified OTP record to prevent concurrent replay.
    const { data: consumedOtpRecord, error: consumeOtpError } = await supabaseAdmin
      .from('otp_verifications')
      .delete()
      .eq('id', otpId)
      .eq('verified', true)
      .gte('verified_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .select('id')
      .maybeSingle();

    if (consumeOtpError) {
      logger.error('complete_signup.otp_consume_failed', { error: consumeOtpError, otpId });
      return NextResponse.json(
        { error: 'Internal system error clearing session token' },
        { status: 500 }
      );
    }

    if (!consumedOtpRecord) {
      logger.warn('complete_signup.otp_already_consumed', { otpId });
      return NextResponse.json(
        { error: 'OTP verification session has already been used. Please request a new code.' },
        { status: 400 }
      );
    }

    // Check if user already exists — targeted query avoids fetching all users
    const orFilters: string[] = [];
    if (email) orFilters.push(`email.eq.${email}`);
    if (normalizedMobile) orFilters.push(`mobile.eq.${normalizedMobile}`);

    if (orFilters.length > 0) {
      const { data: existingProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(orFilters.join(','))
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0) {
        return NextResponse.json(
          { error: 'An account with this email or mobile already exists' },
          { status: 409 }
        );
      }
    }

    // Create user account NOW (after OTP verification)
    const loginEmail = email || `${normalizedMobile}@tecbunny.phone`;
    const userPayload: Record<string, any> = {
      password,
      phone: `+${normalizedMobile}`,
      phone_confirm: true,
      email: loginEmail,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'customer',
        mobile: normalizedMobile
      }
    };

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser(userPayload);

    if (createError) {
      logger.error('complete_signup.create_user_failed', { error: createError, email });
      
      // Handle specific error cases
      if (createError.message.includes('already been registered') || 
          createError.message.includes('User already registered') ||
          createError.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email or mobile already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: `Failed to create account: ${createError.message}` },
        { status: 500 }
      );
    }

    logger.info('complete_signup.user_created', { email: userData.user.email });

    // Create profile record explicitly
    try {
      const profilePayload: Record<string, any> = {
        id: userData.user.id,
        name,
        full_name: name,
        role: 'customer',
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (userData.user.email) {
        profilePayload.email = userData.user.email;
      }

      if (normalizedMobile) {
        profilePayload.mobile = normalizedMobile;
        profilePayload.phone = normalizedMobile;
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });

      if (profileError && !profileError.message.includes('duplicate key')) {
        logger.error('complete_signup.profile_create_failed', { error: profileError, userId: userData.user.id });
        // Continue anyway - profile creation failure shouldn't break signup
      } else {
        logger.info('complete_signup.profile_created', { userId: userData.user.id });
      }
    } catch (profileErr) {
      logger.error('complete_signup.profile_create_error', { error: profileErr, userId: userData.user.id });
      // Continue anyway
    }

    // Create session for immediate login
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.error('complete_signup.anon_key_missing');
      return NextResponse.json({
        message: 'Account created successfully! Please contact support to complete sign-in.',
        requiresSignIn: true
      }, { status: 503 });
    }

    const regularSupabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    const signInPayload: Record<string, string> = { password };
    if (email) {
      signInPayload.email = email;
    } else {
      signInPayload.email = `${normalizedMobile}@tecbunny.phone`;
    }

    const { data: signInData, error: signInError } = await regularSupabase.auth.signInWithPassword({
      email: signInPayload.email,
      password,
    });

    if (signInError) {
      logger.error('complete_signup.signin_failed', { error: signInError, userId: userData.user.id });
      // Account was created successfully, but sign-in failed
      return NextResponse.json({
        message: 'Account created successfully! Please sign in to continue.',
        user: {
          id: userData.user.id,
          email: userData.user.email ?? null,
          name: userData.user.user_metadata?.name
        },
        requiresSignIn: true
      });
    }

    logger.info('complete_signup.signin_success', { userId: signInData.user.id });

    // Send welcome WhatsApp notification
    if (normalizedMobile) {
      try {
        await sendWelcomeNotification(normalizedMobile, {
          customerName: name,
        });
        logger.info('complete_signup.welcome_whatsapp_sent', { mobile: normalizedMobile });
      } catch (welcomeError: any) {
        logger.error('complete_signup.welcome_whatsapp_failed', { error: welcomeError.message });
      }
    }

    // Create response with redirect
    const response = NextResponse.json({
      message: 'Account created and signed in successfully!',
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
        name: signInData.user.user_metadata?.name
      },
      session: signInData.session,
      requiresSignIn: false,
      redirectTo: '/'
    });

    return response;

  } catch (error) {
    logger.error('complete_signup.unhandled_error', { error });
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
