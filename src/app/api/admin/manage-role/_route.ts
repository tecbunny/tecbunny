import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { logger } from '../../../../lib/logger';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function isAuthorized(req: NextRequest) {
  const token = req.headers.get('x-admin-token');
  return !!token && token === process.env.ADMIN_MAINT_TOKEN;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service configuration error. Please contact support.' }, { status: 503 });
  }

  try {
    const { userId, action } = await request.json();
    
    if (!userId || !['promote', 'demote'].includes(action)) {
      return NextResponse.json({ error: 'userId and valid action (promote/demote) are required' }, { status: 400 });
    }

    // 1) Verify user exists in profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const newRole = action === 'promote' ? 'admin' : 'customer';

    // 2) Update profile role
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
    }
    
    // 3) Update auth metadata (if using syncing, though we moved to profiles-only, keeping this consistent is good practice)
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { role: newRole }
    });

    return NextResponse.json({ 
      ok: true, 
      userId, 
      previousRole: profile.role,
      newRole,
      message: `User successfully ${action}d.` 
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
