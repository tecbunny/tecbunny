import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { createSupabaseClient as createPublicSupabaseClient } from '@/lib/supabase-server';
import { verifySuperadminSessionToken } from '@/lib/auth/superadmin-session';
import { logger } from '@/lib/logger';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing service ID' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const superadminCookie = cookieStore.get('superadmin-session')?.value;
    const isSuperadmin = Boolean(await verifySuperadminSessionToken(superadminCookie));

    if (!isSuperadmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      title,
      name,
      description,
      price,
      terms_and_conditions,
      icon,
      badge,
      category,
      duration_days,
      display_order,
      is_active,
      features,
    } = body;

    const resolvedName = name || title;
    const resolvedTitle = title || name;

    const supabase = isSupabaseServiceConfigured
      ? createServiceClient()
      : createPublicSupabaseClient();

    const updateData: Record<string, any> = {};
    if (resolvedName !== undefined) {
      updateData.name = resolvedName;
      updateData.title = resolvedTitle;
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    if (price !== undefined) {
      updateData.price = price === null ? null : Number(price);
    }
    if (terms_and_conditions !== undefined) {
      updateData.terms_and_conditions = terms_and_conditions;
    }
    if (icon !== undefined) {
      updateData.icon = icon;
    }
    if (badge !== undefined) {
      updateData.badge = badge;
    }
    if (category !== undefined) {
      updateData.category = category;
    }
    if (duration_days !== undefined) {
      updateData.duration_days = duration_days === null ? null : Number(duration_days);
    }
    if (display_order !== undefined) {
      updateData.display_order = Number(display_order);
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }
    if (features !== undefined) {
      updateData.features = Array.isArray(features) ? features : [];
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('superadmin_service_update_failed', { error: error.message, id, body });
      return NextResponse.json({ error: 'Failed to update service: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, service: data });
  } catch (error) {
    logger.error('superadmin_service_update_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing service ID' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const superadminCookie = cookieStore.get('superadmin-session')?.value;
    const isSuperadmin = Boolean(await verifySuperadminSessionToken(superadminCookie));

    if (!isSuperadmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = isSupabaseServiceConfigured
      ? createServiceClient()
      : createPublicSupabaseClient();

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('superadmin_service_delete_failed', { error: error.message, id });
      return NextResponse.json({ error: 'Failed to delete service: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('superadmin_service_delete_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
