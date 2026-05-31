import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseServiceClient } from '@/lib/supabase-server';

// Simple admin guard via header token (set in Vercel env)
function isAuthorized(req: NextRequest) {
  const token = req.headers.get('x-admin-token');
  return !!token && token === process.env.ADMIN_MAINT_TOKEN;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data: rows, error } = await supabase
      .from('settings')
      .select('id, key, updated_at, created_at')
      .eq('key', 'payment_phonepe')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rows || rows.length <= 1) {
      return NextResponse.json({ ok: true, removed: 0, keptId: rows?.[0]?.id ?? null });
    }

    // Keep the first (latest), delete the rest
    const keepId = rows[0].id as number;
    const deleteIds = rows.slice(1).map((r) => r.id as number);

    const { error: delErr } = await supabase
      .from('settings')
      .delete()
      .in('id', deleteIds);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, removed: deleteIds.length, keptId: keepId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 15;
