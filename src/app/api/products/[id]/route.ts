import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { getSessionWithRole } from '@/lib/auth/server-role';
import { logger } from '@/lib/logger';

const ADMIN_ROLES = new Set(['admin', 'manager']);

// Update individual product (PATCH)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Get session and check permissions
    const { supabase: authClient, role, session } = await getSessionWithRole(request);
    
    if (!session?.user || !role || !ADMIN_ROLES.has(role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use service client for admin operations
    const supabase = isSupabaseServiceConfigured ? createServiceClient() : authClient;

    // Parse request body
    const updateData = await request.json();
    
    logger.info('product_update_request', { 
      productId, 
      updateFields: Object.keys(updateData),
      userId: session.user.id,
      role 
    });

    // Handle prioritized field specially to update prioritized_at timestamp
    if ('prioritized' in updateData) {
      if (updateData.prioritized) {
        updateData.prioritized_at = new Date().toISOString();
      } else {
        updateData.prioritized_at = null;
      }
    }

    // Update the product
    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select('*')
      .single();

    if (error) {
      logger.error('product_update_failed', { 
        productId, 
        error: error.message,
        userId: session.user.id 
      });
      
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    logger.info('product_update_success', { 
      productId, 
      updatedFields: Object.keys(updateData),
      userId: session.user.id 
    });

    return NextResponse.json({
      success: true,
      data,
      message: 'Product updated successfully'
    });

  } catch (error) {
    logger.error('product_update_error', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

// Get individual product (GET)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const { supabase: authClient, role } = await getSessionWithRole(request);
    const supabase = role && ADMIN_ROLES.has(role) && isSupabaseServiceConfigured
      ? createServiceClient()
      : authClient ?? await createClient();

    // Get the product
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error) {
      logger.error('product_fetch_failed', { 
        productId, 
        error: error.message 
      });
      
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    logger.error('product_fetch_error', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}


