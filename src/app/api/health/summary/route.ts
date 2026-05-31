import { NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const started = Date.now();
  const supabase = await createServerClient();
  let dbOk = false; let dbLatency = 0;
  try {
    const t0 = Date.now();
    const { error } = await supabase.from('products').select('id', { count: 'exact', head: true }).limit(1);
    dbOk = !error; dbLatency = Date.now() - t0;
  } catch { dbOk = false; }

  // Minimal SMTP readiness indicator (env presence)
  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  // Payment config presence (does not reveal secrets)
  const phonePeConfigured = !!process.env.PHONEPE_MERCHANT_ID;
  const razorpayConfigured = !!process.env.RAZORPAY_KEY_ID;

  return NextResponse.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0,7) || 'local',
    db: { ok: dbOk, latencyMs: dbLatency },
    email: { configured: smtpConfigured },
    payments: { phonePeConfigured, razorpayConfigured },
    elapsedMs: Date.now() - started
  });
}
