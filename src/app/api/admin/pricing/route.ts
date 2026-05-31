import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/permissions';

// export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pricing
 * Fetch all product pricing rules with product details
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication and authorization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = isSupabaseServiceConfigured ? createServiceClient() : await createClient();

    // Fetch pricing rules with product information
    const { data: rules, error } = await serviceClient
      .from('product_pricing')
      .select(`
        *,
        products:product_id (
          id,
          title,
          category,
          price
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pricing rules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pricing rules', details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to include product title
    const transformedRules = rules?.map((rule: any) => ({
      ...rule,
      product_title: rule.products?.title || 'Unknown Product',
    }));

    return NextResponse.json({ rules: transformedRules || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/pricing:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pricing
 * Create a new pricing rule
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication and authorization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      product_id,
      customer_type,
      customer_category,
      price,
      min_quantity,
      max_quantity,
      valid_from,
      valid_to,
      is_active,
    } = body;

    // Validation
    if (!product_id || !customer_type || price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: product_id, customer_type, price' },
        { status: 400 }
      );
    }

    if (!['B2C', 'B2B'].includes(customer_type)) {
      return NextResponse.json(
        { error: 'Invalid customer_type. Must be B2C or B2B' },
        { status: 400 }
      );
    }

    const serviceClient = isSupabaseServiceConfigured ? createServiceClient() : await createClient();

    // Insert the pricing rule
    const { data: newRule, error } = await serviceClient
      .from('product_pricing')
      .insert({
        product_id,
        customer_type,
        customer_category: customer_category || null,
        price: parseFloat(price),
        min_quantity: min_quantity ? parseInt(min_quantity) : null,
        max_quantity: max_quantity ? parseInt(max_quantity) : null,
        valid_from: valid_from || null,
        valid_to: valid_to || null,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating pricing rule:', error);
      return NextResponse.json(
        { error: 'Failed to create pricing rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: newRule }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/admin/pricing:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
