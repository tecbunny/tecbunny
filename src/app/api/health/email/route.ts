import { NextResponse } from 'next/server';

import improvedEmailService from '@/lib/improved-email-service';

export async function GET() {
  try {
    const status = await improvedEmailService.getConnectionStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 15;
