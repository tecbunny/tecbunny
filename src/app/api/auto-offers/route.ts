import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isServiceConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const isPublicConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase admin environment variables are not configured');
  }
  return createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function requireRole() {
  if (!isPublicConfigured) {
    logger.error('auto-offers.require-role.missing_supabase_config');
    return {
      error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      status: 503
    } as const;
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Authentication required', status: 401 };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return { error: 'Forbidden', status: 403 };
  }
  return { user, role: profile.role };
}

export async function GET(request: NextRequest) {
  try {
    if (!isServiceConfigured) {
      logger.error('auto-offers.get.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const id = searchParams.get('id');
    
    if (id) {
      // Get specific auto offer by ID
      const { data, error } = await supabaseAdmin
        .from('auto_offers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json(data);
    } else {
      // Get all auto offers
      let query = supabaseAdmin
        .from('auto_offers')
        .select('*')
        .order('priority', { ascending: false });
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
    const { data, error } = await query;
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      return NextResponse.json(data || []);
    }
    
  } catch (error) {
    console.error('Auto offers GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Share-for-Discount Conversion Trigger & Auto Offers Management
 * POST /api/auto-offers
 */
export async function POST(request: NextRequest) {
  try {
    if (!isServiceConfigured) {
      logger.error('auto-offers.post.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { action, blueprintId, platform } = body;

    // Check if this is the viral sharing trigger (public access)
    if (action === 'issue_share_discount') {
      const supabaseAdmin = getSupabaseAdmin();
      
      // Generate dynamic single-use high-priority coupon
      const couponCode = `VIRAL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      const { data: coupon, error } = await supabaseAdmin
        .from('coupons')
        .insert([{
          code: couponCode,
          type: 'percentage',
          value: 10, // 10% viral discount
          status: 'active',
          usage_limit: 1,
          per_user_limit: 1,
          start_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 48h validity
          applicable_category: 'Setup'
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info('viral_discount_issued', { blueprintId, platform, couponCode });

      return NextResponse.json({
        success: true,
        coupon,
        message: 'Share confirmed. 10% discount applied to your current setup.'
      });
    }

    // Standard auto offer creation requires admin/manager role
    const auth = await requireRole();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { 
      title, 
      description, 
      discount_type, 
      discount_value, 
      conditions, 
      is_active = true, 
      auto_apply = false, 
      priority = 0 
    } = body;

    if (!title || !discount_type || !discount_value) {
      return NextResponse.json(
        { error: 'Title, discount type, and discount value are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('auto_offers')
      .insert({
        title,
        description,
        discount_type,
        discount_value: parseFloat(discount_value),
        conditions: conditions || {},
        is_active,
        auto_apply,
        priority: parseInt(priority),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Auto offers POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isServiceConfigured) {
      logger.error('auto-offers.put.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const auth = await requireRole();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = await request.json();
    const { 
      id, 
      title, 
      description, 
      discount_type, 
      discount_value, 
      conditions, 
      is_active, 
      auto_apply, 
      priority 
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (discount_type !== undefined) updateData.discount_type = discount_type;
    if (discount_value !== undefined) updateData.discount_value = parseFloat(discount_value);
    if (conditions !== undefined) updateData.conditions = conditions;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (auto_apply !== undefined) updateData.auto_apply = auto_apply;
    if (priority !== undefined) updateData.priority = parseInt(priority);

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('auto_offers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Auto offers PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isServiceConfigured) {
      logger.error('auto-offers.delete.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const auth = await requireRole();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('auto_offers')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Auto offers DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
