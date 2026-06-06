import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { getSessionWithRole } from '@/lib/auth/server-role';
import { logger } from '@/lib/logger';
import { getProductDisplayImage } from '@/lib/image-utils';
import { isPubliclyVisibleProduct } from '@/lib/product-visibility';
import { classifyProductTax, TaxClassificationError } from '@/lib/ai/tax-classification';

const ADMIN_ROLES = new Set(['admin', 'manager', 'superadmin']);

function pickFirst(...values: unknown[]) {
  return values.find((value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== undefined && value !== null;
  });
}

function taxErrorResponse(error: unknown) {
  if (error instanceof TaxClassificationError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.statusCode }
    );
  }

  logger.error('product_patch_tax_classification_unhandled', { error });
  return NextResponse.json(
    { success: false, error: 'Tax classification failed' },
    { status: 502 }
  );
}

function getUuidAuditUserId(userId: string | undefined): string | null {
  if (!userId || userId === 'superadmin-root-id') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null;
}

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
    const auditUserId = getUuidAuditUserId(session.user.id);

    // Parse request body
    const updateData = await request.json();

    const { data: existingProduct, error: existingProductError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (existingProductError) {
      logger.error('product_patch_existing_fetch_failed', { productId, error: existingProductError.message });
      return NextResponse.json(
        { success: false, error: 'Failed to load existing product' },
        { status: 500 }
      );
    }

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // Media validation gatekeeper check
    const targetStatus = updateData.status;
    if (targetStatus === 'active' || targetStatus === 'published') {
      const hasImagesPayload = 'images' in updateData && Array.isArray(updateData.images);
      let activeImagesCount = 0;
      if (hasImagesPayload) {
        const normalizedImages = updateData.images.map((img: any) => typeof img === 'string' ? img : img?.url).filter(Boolean);
        activeImagesCount = normalizedImages.length;
      } else {
        activeImagesCount = Array.isArray(existingProduct?.images) ? existingProduct.images.length : 0;
      }

      if (activeImagesCount === 0) {
        logger.warn('product_patch_publish_blocked_no_images', { productId });
        return NextResponse.json(
          { success: false, error: 'Product cannot be published without at least one valid image upload reference.' },
          { status: 422 }
        );
      }
    }

    const mergedProductForTax = { ...existingProduct, ...updateData };
    try {
      const taxClassification = await classifyProductTax({
        title: pickFirst(mergedProductForTax.title, mergedProductForTax.name),
        description: mergedProductForTax.description,
        category: mergedProductForTax.category,
        productType: mergedProductForTax.product_type,
        targetIndustry: pickFirst(
          mergedProductForTax.target_industry,
          mergedProductForTax.industry,
          mergedProductForTax.industryType
        ),
        brand: pickFirst(mergedProductForTax.brand, mergedProductForTax.vendor),
        modelNumber: mergedProductForTax.model_number,
        specifications: mergedProductForTax.specifications,
      });
      updateData.hsn_code = taxClassification.hsn_code;
      updateData.gst_rate = taxClassification.gst_rate;
      updateData.tax_ai_confidence = taxClassification.confidence_score;
      updateData.tax_ai_justification = taxClassification.justification;
      updateData.tax_ai_model = 'gemini-2.5-flash-lite';
      updateData.tax_ai_classified_at = new Date().toISOString();
      if (auditUserId) {
        updateData.tax_ai_requested_by = auditUserId;
      }
      updateData.tax_ai_reviewed = false;
      updateData.tax_ai_reviewed_by = null;
      updateData.tax_ai_reviewed_at = null;
    } catch (error) {
      return taxErrorResponse(error);
    }

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
    const isPrivilegedRequest = Boolean(role && ADMIN_ROLES.has(role));
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

    if (!isPrivilegedRequest && !isPubliclyVisibleProduct(data)) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    if (data) {
      data.image = getProductDisplayImage(data) || data.image || null;
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


