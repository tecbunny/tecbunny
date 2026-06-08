import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { logger } from '@/lib/logger';


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const getSupabaseAdmin = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function isAuthorized(req: NextRequest) {
  const token = req.headers.get('x-admin-token');
  return !!token && token === process.env.ADMIN_MAINT_TOKEN;
}

const roleMutationSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['promote', 'demote']),
}).strict();

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service configuration error. Please contact support.' }, { status: 503 });
  }

  try {
    const parsed = roleMutationSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid role mutation request', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userId, action } = parsed.data;

    // 1) Verify user exists in profiles
    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const newRole = action === 'promote' ? 'admin' : 'customer';

    const { data: authUserData, error: authUserError } = await getSupabaseAdmin().auth.admin.getUserById(userId);
    if (authUserError) {
      logger.error('admin_role_change_auth_user_fetch_failed', {
        userId,
        error: authUserError.message,
      });
      return NextResponse.json({ error: 'Failed to load auth user metadata' }, { status: 500 });
    }

    // 2) Update profile role
    const { error: updateError } = await getSupabaseAdmin()
      .from('profiles')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
    }

    // Log the role alteration to security audit log
    await getSupabaseAdmin()
      .from('security_audit_log')
      .insert({
        event_type: 'role_alteration',
        user_id: userId,
        event_data: {
          action,
          previous_role: profile.role,
          new_role: newRole,
          modified_by: 'maint_token_admin'
        },
        severity: 'high'
      });
    
    // 3) Keep server-controlled auth app metadata in sync.
    const { error: authUpdateError } = await getSupabaseAdmin().auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(authUserData.user?.app_metadata ?? {}),
        role: newRole,
      }
    });

    if (authUpdateError) {
      await getSupabaseAdmin()
        .from('profiles')
        .update({
          role: profile.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      logger.error('admin_role_change_auth_metadata_failed', {
        userId,
        error: authUpdateError.message,
      });
      return NextResponse.json({ error: 'Failed to update auth role metadata' }, { status: 500 });
    }

    logger.info('admin_role_change_success', {
      userId,
      action,
      previousRole: profile.role,
      newRole,
      changedBy: 'maint_token_admin',
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
