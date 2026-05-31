import { NextRequest, NextResponse } from 'next/server';

import { verifyCaptcha } from '@/lib/captcha/captcha-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/captcha/verify
 * Verifies CAPTCHA response from client
 */
export async function POST(request: NextRequest) {
  try {
  const body = await request.json();
  const { response } = body;
    
    if (!response) {
      return NextResponse.json(
        { success: false, error: 'CAPTCHA response is required' },
        { status: 400 }
      );
    }
    
    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    
    const result = await verifyCaptcha(response, ip);
    
    return NextResponse.json(result);
  } catch (error) {
    logger.error('captcha_verify_failed', { error });
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'CAPTCHA verification failed. Please try again.' 
      },
      { status: 500 }
    );
  }
}
