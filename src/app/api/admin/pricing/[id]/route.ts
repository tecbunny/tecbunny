import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/permissions';

// export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/pricing/[id]
 * Update a pricing rule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const serviceClient = isSupabaseServiceConfigured ? createServiceClient() : await createClient();

    // Update the pricing rule
    const { data: updatedRule, error } = await serviceClient
      .from('product_pricing')
      .update({
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
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating pricing rule:', error);
      return NextResponse.json(
        { error: 'Failed to update pricing rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: updatedRule });
  } catch (error) {
    console.error('Unexpected error in PUT /api/admin/pricing/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/pricing/[id]
 * Delete a pricing rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Delete the pricing rule
    const { error } = await serviceClient
      .from('product_pricing')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting pricing rule:', error);
      return NextResponse.json(
        { error: 'Failed to delete pricing rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Pricing rule deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/admin/pricing/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



export async function GET() { return Response.json({}) }



