import { NextRequest, NextResponse } from 'next/server';

import { requireApiRole, type RoleCheckOptions } from '../../../lib/server-role-guard';

const INVENTORY_ACCESS: RoleCheckOptions = {
  allowedRoles: ['sales', 'manager'],
  minimumRole: 'admin'
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
        stock_quantity: product.quantity || 0,
        stock_label: product.quantity === 0 ? 'Out of Stock' : 
                    product.quantity <= 5 ? 'Low Stock' : 'In Stock',
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
    const { supabase } = access;
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

    // Ensure quantity is a valid number
    const moveQuantity = Math.abs(parseInt(quantity));

    // Use the stock movement function
    const { data, error } = await supabase.rpc('record_stock_movement', {
      p_product_id: product_id,
      p_movement_type: movement_type,
      p_quantity: moveQuantity,
      p_reference_type: reference_type || 'api_adjustment',
      p_notes: notes || `Stock ${movement_type} via API`
    });

    if (error) {
      console.error('Stock movement error:', error);
      
      // Fallback to direct inventory update if function fails
      let currentQuantity = 0;
      
      // Get current quantity
      const { data: currentInventory } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', product_id)
        .single();
      
      if (currentInventory) {
        currentQuantity = currentInventory.quantity || 0;
      }
      
      // Calculate new quantity
      let newQuantity;
      switch (movement_type) {
        case 'in':
          newQuantity = currentQuantity + moveQuantity;
          break;
        case 'out':
          newQuantity = Math.max(0, currentQuantity - moveQuantity);
          break;
        case 'adjustment':
          newQuantity = moveQuantity;
          break;
        default:
          newQuantity = currentQuantity;
      }
      
      // Upsert inventory record
      const { error: directError } = await supabase
        .from('inventory')
        .upsert({
          product_id,
          quantity: newQuantity,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'product_id'
        });

      if (directError) {
        return NextResponse.json(
          { error: 'Failed to update stock', details: directError.message },
          { status: 500 }
        );
      }

      // Record movement manually
      await supabase
        .from('stock_movements')
        .insert({
          product_id,
          movement_type,
          quantity: moveQuantity,
          reference_type: reference_type || 'api_adjustment',
          notes: notes || `Stock ${movement_type} via API (fallback)`
        });

      return NextResponse.json({ 
        success: true, 
        message: 'Stock updated (direct method)',
        new_quantity: newQuantity
      });
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
    const { supabase } = access;
    const { product_id, new_quantity } = await request.json();

    if (!product_id || new_quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: product_id and new_quantity' },
        { status: 400 }
      );
    }

    // Ensure new_quantity is a valid number
    const quantity = Math.max(0, parseInt(new_quantity));

    // Use upsert with proper conflict resolution
    const { data: _data, error } = await supabase
      .from('inventory')
      .upsert({
        product_id,
        quantity,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'product_id'
      })
      .select();

    if (error) {
      console.error('Inventory upsert error:', error);
      
      // Fallback: try updating existing record
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ 
          quantity,
          last_updated: new Date().toISOString() 
        })
        .eq('product_id', product_id);

      if (updateError) {
        console.error('Inventory update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update inventory', details: updateError.message },
          { status: 500 }
        );
      }
    }

    // Also update the products table quantity field for consistency
    await supabase
      .from('products')
      .update({ 
        quantity,
        stock_quantity: quantity 
      })
      .eq('id', product_id);

    return NextResponse.json({ 
      success: true, 
      message: 'Inventory updated successfully',
      new_quantity: quantity
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
