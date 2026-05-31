import { NextRequest, NextResponse } from 'next/server';

import { rateLimit } from '@/lib/rate-limit';
import { createClient as createServerClient } from '@/lib/supabase/server';

import { logger } from '@/lib/logger';

export interface EmailHandlerConfig<T, R = { success: true }> {
  validate: (body: any) => { ok: true; data: T } | { ok: false; error: string };
  // action returns either boolean (legacy) or a richer payload R | false
  action: (data: T) => Promise<boolean | R>;
  rate: { bucket: string; limit: number; windowMs: number };
}

export async function handleEmailPost<T, R = { success: true }>(request: NextRequest, cfg: EmailHandlerConfig<T, R>) {
  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const body = await request.json().catch(() => undefined);
    const validated = cfg.validate(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // User or IP based key
    let userId: string | null = null;
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch { /* ignore */ }
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = userId ? `user:${userId}` : `ip:${ip}`;
    if (!rateLimit(rateKey, cfg.rate.bucket, { limit: cfg.rate.limit, windowMs: cfg.rate.windowMs })) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const result = await cfg.action(validated.data);
    const res = result
      ? NextResponse.json(typeof result === 'object' ? (result as any) : { success: true })
      : NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'same-origin');
    return res;
  } catch (error) {
    logger.error('Email route error', { error, context: 'handleEmailPost' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}