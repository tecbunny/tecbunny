import { NextRequest, NextResponse } from 'next/server';

import { requireApiRole, type RoleCheckOptions } from '@/lib/server-role-guard';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';

const INVENTORY_ACCESS: RoleCheckOptions = {
  allowedRoles: ['sales', 'manager'],
  minimumRole: 'admin'
};

const LEGACY_MOVEMENT_MAP: Record<string, string> = {
  in: 'purchase_receipt',
  out: 'online_sale',
  adjustment: 'adjustment',
  transfer: 'transfer',
};

const parseNonNegativeInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

export async function GET(_request: NextRequest) {
  try {
    const access = await requireApiRole(INVENTORY_ACCESS);
    if ('error' in access) {
      return access.error;
    }
    const { supabase } = access;
    
    // Get inventory summary using the consolidated view
    const { data: inventory, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name');

    if (error) {
      console.error('Inventory fetch error:', error);
      // Fallback to products table
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (prodError) {
        return NextResponse.json(
          { error: 'Failed to fetch inventory data' },
          { status: 500 }
        );
      }

      // Transform products to inventory format
      const inventoryData = products.map(product => ({
        ...product,
        stock_quantity: product.stock_quantity || 0,
        stock_label: product.stock_quantity === 0 ? 'Out of Stock' : 
                    product.stock_quantity <= 5 ? 'Low Stock' : 'In Stock',
        warehouse_location: 'Main Warehouse',
        minimum_stock: product.minimum_stock || 5,
        available_serials: 0
      }));

      return NextResponse.json({ inventory: inventoryData });
    }

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error('Inventory API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiRole(INVENTORY_ACCESS);
    if ('error' in access) {
      return access.error;
    }
    const supabase = isSupabaseServiceConfigured ? createServiceClient() : access.supabase;
    const { product_id, movement_type, quantity, notes, reference_type } = await request.json();

    if (!product_id || !movement_type || quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: product_id, movement_type, quantity' },
        { status: 400 }
      );
    }

    // Validate movement type
    const validMovementTypes = ['in', 'out', 'adjustment', 'transfer'];
    if (!validMovementTypes.includes(movement_type)) {
      return NextResponse.json(
        { error: `Invalid movement_type. Must be one of: ${validMovementTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const moveQuantity = parseNonNegativeInt(quantity);
    if (moveQuantity === null || moveQuantity === 0) {
      return NextResponse.json(
        { error: 'quantity must be a positive integer' },
        { status: 400 }
      );
    }

    const canonicalMovementType = LEGACY_MOVEMENT_MAP[movement_type];

    const { data, error } = await supabase.rpc('record_atomic_stock_movement', {
      p_product_id: product_id,
      p_movement_type: canonicalMovementType,
      p_quantity: moveQuantity,
      p_reference_id: null,
      p_reference_type: reference_type || 'api_adjustment',
      p_notes: notes || `Stock ${canonicalMovementType} via API`,
      p_allow_negative: false,
      p_created_by: access.session?.user.id || null
    });

    if (error) {
      console.error('Stock movement error:', error);
      return NextResponse.json(
        { error: 'Atomic stock movement failed', details: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Stock movement recorded successfully',
      movement_id: data 
    });
  } catch (error) {
    console.error('Stock update error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await requireApiRole(INVENTORY_ACCESS);
    if ('error' in access) {
      return access.error;
    }
    if (!access.role || !['manager', 'admin', 'superadmin'].includes(access.role)) {
      return NextResponse.json({ error: 'Only managers and administrators can perform absolute stock adjustments' }, { status: 403 });
    }
    const supabase = isSupabaseServiceConfigured ? createServiceClient() : access.supabase;
    const { product_id, new_quantity } = await request.json();

    if (!product_id || new_quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: product_id and new_quantity' },
        { status: 400 }
      );
    }

    const quantity = parseNonNegativeInt(new_quantity);
    if (quantity === null) {
      return NextResponse.json(
        { error: 'new_quantity must be a non-negative integer' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('record_atomic_stock_movement', {
      p_product_id: product_id,
      p_movement_type: 'adjustment',
      p_quantity: quantity,
      p_reference_id: null,
      p_reference_type: 'api_adjustment',
      p_notes: 'Inventory absolute quantity adjustment',
      p_allow_negative: false,
      p_created_by: access.session?.user.id || null
    });

    if (error) {
      console.error('Inventory atomic adjustment error:', error);
      return NextResponse.json(
        { error: 'Atomic stock adjustment failed', details: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Inventory updated successfully',
      new_quantity: quantity,
      result: data
    });
  } catch (error) {
    console.error('Inventory PUT error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
