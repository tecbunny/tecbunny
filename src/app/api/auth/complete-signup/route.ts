import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { logger } from '../../../../lib/logger';
import { sendWelcomeNotification } from '../../../../lib/whatsapp-service';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

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
    
    const { email, password, name, mobile, otpVerified } = await request.json();

    // Validate required fields
    if (!password || !name || !mobile) {
      return NextResponse.json(
        { error: 'Mobile, password, and name are required' },
        { status: 400 }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (!otpVerified) {
      return NextResponse.json(
        { error: 'OTP verification is required before account creation' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const normalizedMobile = String(mobile).replace(/\D/g, '');
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u =>
      (email && u.email === email) ||
      (normalizedMobile && (u.phone === normalizedMobile || u.user_metadata?.mobile === normalizedMobile))
    );
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email or mobile already exists' },
        { status: 409 }
      );
    }

    // Create user account NOW (after OTP verification)
    const userPayload: Record<string, any> = {
      password,
      user_metadata: {
        name,
        role: 'customer',
        ...(mobile && { mobile: normalizedMobile })
      }
    };

    if (email) {
      userPayload.email = email;
      userPayload.email_confirm = true;
    } else {
      userPayload.phone = normalizedMobile;
      userPayload.phone_confirm = true;
    }

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser(userPayload);

    if (createError) {
      logger.error('complete_signup.create_user_failed', { error: createError, email });
      
      // Handle specific error cases
      if (createError.message.includes('already been registered') || 
          createError.message.includes('User already registered')) {
        return NextResponse.json(
          { error: 'An account with this email or mobile already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
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
      signInPayload.phone = normalizedMobile;
    }

    const { data: signInData, error: signInError } = await regularSupabase.auth.signInWithPassword(signInPayload as any);

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

    // Set auth cookies for automatic sign-in
    if (signInData.session) {
      // Access token is sent to client via JSON as well; keep it accessible to client-side JS.
      response.cookies.set('sb-access-token', signInData.session.access_token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: signInData.session.expires_in
      });

      // Refresh token should be HttpOnly to reduce XSS risk.
      response.cookies.set('sb-refresh-token', signInData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });
    }

    return response;

  } catch (error) {
    logger.error('complete_signup.unhandled_error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
