import { NextResponse } from 'next/server';
import { verifyCaptcha } from '@/lib/captcha/captcha-service';
import { logger } from '@/lib/logger';

function getClientIp(request: Request) {
  const headers = request.headers;
  return headers.get('cf-connecting-ip')?.trim()
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')?.trim()
    || 'unknown';
}

export async function POST(request: Request) {
  try {
    const { userId, email, password, captchaToken } = await request.json();
    const ip = getClientIp(request);
    const submittedUserId = String(userId ?? email ?? '').trim();

    // Verify Turnstile Captcha if site key is configured
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (turnstileSiteKey) {
      const captcha = await verifyCaptcha(captchaToken, ip);
      if (!captcha.success) {
        logger.warn('superadmin_login.captcha_failed', { ip, error: captcha.error || captcha.errorCodes });
        return NextResponse.json({ error: 'Security verification failed. Please try again.' }, { status: 400 });
      }
    }

    const correctUserId = process.env.SUPERADMIN_USER_ID || process.env.SUPERADMIN_EMAIL;
    const correctPassword = process.env.SUPERADMIN_PASSWORD;

    if (!correctUserId || !correctPassword) {
      logger.error('superadmin_login.configuration_missing');
      return NextResponse.json({ error: 'Superadmin credentials are not configured on server.' }, { status: 500 });
    }

    if (submittedUserId !== correctUserId.trim() || password !== correctPassword) {
      logger.warn('superadmin_login.failed_attempt', { userId: submittedUserId, ip });
      return NextResponse.json({ error: 'Invalid superadmin credentials.' }, { status: 401 });
    }

    // Generate secure session token (SHA-256 hash of credentials + secret salt)
    const secret = process.env.SUPERADMIN_PASSWORD || 'superadmin_salt_key_default';
    const msgBuffer = new TextEncoder().encode(`${correctUserId}:${correctPassword}:${secret}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const token = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    logger.info('superadmin_login.success', { userId: submittedUserId, ip });

    const response = NextResponse.json({ success: true, message: 'Superadmin authenticated successfully' });

    // Set secure cookie
    response.cookies.set('superadmin-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return response;
  } catch (error) {
    logger.error('superadmin_login.error', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Internal server error during authentication' }, { status: 500 });
  }
}
