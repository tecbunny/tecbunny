import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Service configuration error. Please contact support.' }, { status: 503 });
    }
    const checks: any = { ok: true, db: {}, paymentSettings: {}, tables: {} };

    // Check settings/payment_phonepe - tolerate duplicates and summarize
    const { data: phonepeRows, error: phonepeErr } = await supabase
      .from('settings')
      .select('id, value, updated_at, created_at')
      .eq('key', 'payment_phonepe')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (phonepeErr) {
      checks.paymentSettings.phonepe = { ok: false, error: phonepeErr.message };
    } else {
      const count = phonepeRows?.length || 0;
      const latest = phonepeRows?.[0]?.value;
      checks.paymentSettings.phonepe = { ok: true, count, latestConfigured: !!latest };
    }

    // Check tables existence by simple count
    for (const t of ['orders', 'payment_transactions']) {
      const { count, error } = await supabase
        .from(t as any)
        .select('*', { count: 'exact', head: true });
      checks.tables[t] = error ? { ok: false, error: error.message } : { ok: true, count };
    }

    return NextResponse.json(checks);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 15;
