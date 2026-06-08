import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth/guard';
import { normalizeRole, UserRole } from '@/lib/roles';
import { createServiceClient , isSupabaseServiceConfigured , createClient } from '@/lib/supabase/server';

interface Body {
  userId: string;
  newRole: UserRole;
  note?: string;
}

// POST /api/admin/roles/set
export async function POST(req: Request) {
  const ctx = await requireRole('admin'); // admin baseline
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body?.userId || !body?.newRole) {
      return NextResponse.json({ error: 'userId and newRole required' }, { status: 400 });
    }

    const { userId, note } = body;
    const newRole = normalizeRole(body.newRole);
    if (!newRole) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Block self-demotion or self-promotion patterns as needed (optional)
    if (ctx.user.id === userId && newRole !== ctx.role) {
      return NextResponse.json({ error: 'Self role change not permitted' }, { status: 400 });
    }

    const privilegedRoles = new Set<UserRole>(['admin', 'superadmin']);
    const targetPrivilegedRole = privilegedRoles.has(newRole);
    const actorIsSuperadmin = ctx.role === 'superadmin';
    if (targetPrivilegedRole && !actorIsSuperadmin) {
      return NextResponse.json({ error: 'Only superadmin can grant privileged roles' }, { status: 403 });
    }

    const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient();
    const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (!targetProfile) {
      return NextResponse.json({ error: 'Target user profile not found' }, { status: 404 });
    }
    const previousRole = normalizeRole(targetProfile.role);
    if (previousRole && privilegedRoles.has(previousRole) && !actorIsSuperadmin) {
      return NextResponse.json({ error: 'Only superadmin can modify privileged users' }, { status: 403 });
    }

    // Update profiles.role via RPC for audit (preferred) else fallback
    const { error: rpcError } = await supabase.rpc('admin_set_user_role', { p_user_id: userId, p_role: newRole, p_note: note ?? null });
    if (rpcError) {
      return NextResponse.json({ error: 'Role update failed', details: rpcError.message }, { status: 500 });
    }

    // Log the role alteration to security audit log
    await supabase
      .from('security_audit_log')
      .insert({
        event_type: 'role_alteration',
        user_id: userId,
        event_data: {
          action: 'set',
          previous_role: targetProfile.role,
          new_role: newRole,
          modified_by: ctx.user.id,
          note: note ?? null
        },
        severity: 'high'
      });

    if (isSupabaseServiceConfigured) {
      const { error: metadataError } = await supabase.auth.admin.updateUserById(userId, {
        app_metadata: { role: newRole }
      });
      if (metadataError) {
        return NextResponse.json({ error: 'Role metadata sync failed', details: metadataError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, userId, newRole });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
