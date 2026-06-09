import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { OTPManager } from '@/lib/otp-manager';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const ACTIVATE_RATE_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 };

const activateSchema = z.object({
  serialNumber: z.string().min(3).max(64),
  mobile: z.string().min(10).max(15),
  otp: z.string().regex(/^\d{6}$/),
  otpId: z.string().min(1),
});

function normalizeMobile(value: string) {
  return value.replace(/\D/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      'anonymous';

    if (!rateLimit(ip, 'warranty_activate', ACTIVATE_RATE_LIMIT)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const parsed = activateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Serial number, mobile, and 6-digit OTP are required.' }, { status: 400 });
    }

    const mobile = normalizeMobile(parsed.data.mobile);
    const serialNumber = parsed.data.serialNumber.trim();

    const otpManager = new OTPManager();
    const verification = await otpManager.verifyOTP({
      otpId: parsed.data.otpId,
      code: parsed.data.otp,
    });

    if (!verification.success) {
      return NextResponse.json({ error: verification.message || 'Invalid or expired OTP.' }, { status: 400 });
    }

    if (!isSupabaseServiceConfigured) {
      return NextResponse.json({ error: 'Service unavailable. Please try again later.' }, { status: 503 });
    }

    const supabase = createServiceClient();

    let deviceType = 'DEFAULT';
    let model = 'TecBunny Device';

    const { data: inventoryItem } = await supabase
      .from('inventory_items')
      .select('product_name, category, serial_number')
      .eq('serial_number', serialNumber)
      .maybeSingle();

    if (inventoryItem) {
      model = inventoryItem.product_name || model;
      const category = String(inventoryItem.category || '').toUpperCase();
      if (category.includes('CAMERA') || category.includes('CCTV')) {
        deviceType = 'IP_CAMERA';
      } else if (category.includes('BIOMETRIC') || category.includes('ACCESS')) {
        deviceType = 'BIOMETRIC';
      }
    }

    const { error: warrantyError } = await supabase.from('warranties').insert({
      serial_number: serialNumber,
      phone_identifier: mobile,
      device_type: deviceType,
      status: 'ACTIVE_SLA',
    });

    if (warrantyError) {
      logger.error('warranty_activate_insert_failed', { error: warrantyError.message, serialNumber });
      return NextResponse.json({ error: 'Could not activate warranty. Please contact support.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      device: { type: deviceType, model },
    });
  } catch (error) {
    logger.error('warranty_activate_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to activate warranty.' }, { status: 500 });
  }
}
