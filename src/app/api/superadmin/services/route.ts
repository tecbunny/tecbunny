import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { createSupabaseClient as createPublicSupabaseClient } from '@/lib/supabase-server';
import { verifySuperadminSessionToken } from '@/lib/auth/superadmin-session';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const superadminCookie = cookieStore.get('superadmin-session')?.value;
    const isSuperadmin = Boolean(await verifySuperadminSessionToken(superadminCookie));

    if (!isSuperadmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = isSupabaseServiceConfigured
      ? createServiceClient()
      : createPublicSupabaseClient();

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('superadmin_services_fetch_failed', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
    }

    return NextResponse.json({ services: data ?? [] });
  } catch (error) {
    logger.error('superadmin_services_fetch_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Use name as primary, but fallback to title for legacy DB columns
    const resolvedName = name || title;
    const resolvedTitle = title || name;

    if (!resolvedName) {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }

    const supabase = isSupabaseServiceConfigured
      ? createServiceClient()
      : createPublicSupabaseClient();

    // Map fields carefully to DB columns
    const insertData = {
      name: resolvedName,
      title: resolvedTitle,
      description,
      price: price !== undefined ? Number(price) : null,
      terms_and_conditions,
      icon: icon || 'Wrench',
      badge: badge || null,
      category: category || 'Support',
      duration_days: duration_days !== undefined ? Number(duration_days) : null,
      display_order: display_order !== undefined ? Number(display_order) : 0,
      is_active: is_active !== false,
      features: Array.isArray(features) ? features : [],
    };

    const { data, error } = await supabase
      .from('services')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      logger.error('superadmin_service_create_failed', { error: error.message, body });
      return NextResponse.json({ error: 'Failed to create service: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, service: data });
  } catch (error) {
    logger.error('superadmin_service_create_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
