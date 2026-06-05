import { NextResponse } from 'next/server';

import { otpManager } from '@/lib/otp-manager';

export async function GET() {
  try {
    const testEmail = 'healthcheck@example.com';
    const otp = await otpManager.generateOTP();
    const stored = await otpManager.storeOTP(testEmail, otp, 'signup');
    return NextResponse.json({ ok: true, stored });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 15;
