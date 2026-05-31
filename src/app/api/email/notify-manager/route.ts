import { NextRequest, NextResponse } from 'next/server';

import * as z from 'zod';

import { emailHelpers } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';
import { isAtLeast } from '@/lib/roles';

// Simple in-memory dedupe to avoid duplicate sends in quick succession (best-effort only)
const recentSends = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000; // 60 seconds

const PayloadSchema = z.object({
  // If provided, only used when caller is authorized (admin/manager or internal key)
  to: z.union([z.string(), z.array(z.string())]).optional(),
  orderId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  orderItems: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().int().min(1),
        price: z.number().nonnegative(),
      })
    )
    .optional(),
  orderTotal: z.number().nonnegative().optional(),
});

async function resolveManagerRecipients(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['managerEmails', 'notificationManagerEmails'])
      .limit(2);

    if (error) throw error;

    const emails: string[] = [];
    for (const row of data || []) {
      const val = row.value;
      if (typeof val === 'string') {
        // Try JSON array first, else CSV
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) emails.push(...parsed.filter(Boolean));
          else emails.push(...val.split(',').map((s) => s.trim()).filter(Boolean));
        } catch {
          emails.push(...val.split(',').map((s) => s.trim()).filter(Boolean));
        }
      } else if (Array.isArray(val)) {
        emails.push(...val.filter(Boolean));
      }
    }

    if (emails.length > 0) return emails;
  } catch {
    // fall through to env
  }

  const envCsv = process.env.MANAGER_EMAILS || process.env.SMTP_FROM_EMAIL || '';
  return envCsv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function isAuthorized(request: NextRequest): Promise<{ ok: boolean; role: 'internal' | 'admin' | 'manager' | null }> {
  const internalKey = request.headers.get('x-internal-api-key');
  if (internalKey && process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
  return { ok: true, role: 'internal' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, role: null };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (error) return { ok: false, role: null };

  const role = (profile?.role as any) || 'customer';
  const allowed = isAtLeast(role, 'manager');
  return { ok: !!allowed, role: allowed ? (role === 'admin' ? 'admin' : 'manager') : null };
}

export async function POST(request: NextRequest) {
  try {
    // Enforce content-type JSON
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const auth = await isAuthorized(request);
    if (!auth.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = PayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { orderId, orderItems, orderTotal } = parsed.data;

    // Dedupe recent sends for the same orderId
    const now = Date.now();
    const last = recentSends.get(orderId);
    if (last && now - last < DEDUPE_WINDOW_MS) {
      return NextResponse.json({ success: true, message: 'Duplicate suppressed' });
    }

    // Resolve recipients: prefer settings/env; allow explicit `to` only for admin/manager/internal
    let recipients: string[] = [];
  if (auth.role === 'internal' || auth.role === 'admin' || auth.role === 'manager') {
      const explicit = parsed.data.to
        ? (Array.isArray(parsed.data.to) ? parsed.data.to : [parsed.data.to])
        : [];
      if (explicit.length > 0) {
        recipients = explicit.filter(Boolean);
      }
    }
    if (recipients.length === 0) {
      recipients = await resolveManagerRecipients();
    }
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No manager recipients configured' }, { status: 500 });
    }

    const success = await emailHelpers.notifyManagerNewOrder(recipients, {
      orderId,
      orderItems,
      orderTotal,
    });

    if (success) {
      recentSends.set(orderId, now);
      return NextResponse.json({ success: true, message: 'Manager notification sent' });
    }
    return NextResponse.json({ error: 'Failed to send manager notification' }, { status: 500 });
  } catch (error) {
    console.error('Manager notification email API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
