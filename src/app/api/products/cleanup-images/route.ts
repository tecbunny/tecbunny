import { NextRequest, NextResponse } from 'next/server';

import { createServiceClient, isSupabaseServiceConfigured } from '../../../../lib/supabase/server';
import { getSessionWithRole } from '../../../../lib/auth/server-role';
import { logger } from '../../../../lib/logger';
import { isValidImageUrl } from '../../../../lib/image-utils';

const ADMIN_ROLES = new Set(['admin', 'manager']);

export async function POST(request: NextRequest) {
  try {
    const correlationId = `cleanup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('product_image_cleanup_start', { correlationId });
    
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

    // Get all products
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, handle, title, image, images, additional_images');

    if (fetchError) {
      logger.error('product_image_cleanup_fetch_error', { 
        error: fetchError.message, 
        correlationId 
      });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    let updatedCount = 0;
    let cleanedImages = 0;
    const cleanupResults = [];

    for (const product of products || []) {
      let needsUpdate = false;
      const cleanupInfo: any = {
        id: product.id,
        handle: product.handle,
        title: product.title,
        changes: []
      };

      // Clean main image
      if (product.image && !isValidImageUrl(product.image)) {
        cleanupInfo.changes.push(`Removed invalid main image: "${product.image}"`);
        product.image = null;
        needsUpdate = true;
        cleanedImages++;
      }

      // Clean images array
      if (Array.isArray(product.images)) {
        const validImages = product.images.filter(img => {
          const url = typeof img === 'string' ? img : img?.url || '';
          return isValidImageUrl(url);
        });
        
        if (validImages.length !== product.images.length) {
          const removedCount = product.images.length - validImages.length;
          cleanupInfo.changes.push(`Removed ${removedCount} invalid images from images array`);
          product.images = validImages.length > 0 ? validImages : null;
          needsUpdate = true;
          cleanedImages += removedCount;
        }
      }

      // Clean additional_images array
      if (Array.isArray(product.additional_images)) {
        const validAdditionalImages = product.additional_images.filter(img => {
          const url = typeof img === 'string' ? img : img?.url || '';
          return isValidImageUrl(url);
        });
        
        if (validAdditionalImages.length !== product.additional_images.length) {
          const removedCount = product.additional_images.length - validAdditionalImages.length;
          cleanupInfo.changes.push(`Removed ${removedCount} invalid images from additional_images array`);
          product.additional_images = validAdditionalImages.length > 0 ? validAdditionalImages : null;
          needsUpdate = true;
          cleanedImages += removedCount;
        }
      }

      // Update product if changes were made
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            image: product.image,
            images: product.images,
            additional_images: product.additional_images
          })
          .eq('id', product.id);

        if (updateError) {
          logger.error('product_image_cleanup_update_error', {
            productId: product.id,
            error: updateError.message,
            correlationId
          });
          cleanupInfo.error = updateError.message;
        } else {
          updatedCount++;
          logger.info('product_image_cleanup_updated', {
            productId: product.id,
            changes: cleanupInfo.changes,
            correlationId
          });
        }
      }

      if (needsUpdate || cleanupInfo.error) {
        cleanupResults.push(cleanupInfo);
      }
    }

    logger.info('product_image_cleanup_complete', {
      totalProducts: products?.length || 0,
      updatedProducts: updatedCount,
      cleanedImages,
      correlationId
    });

    return NextResponse.json({
      success: true,
      message: 'Image cleanup completed',
      data: {
        totalProducts: products?.length || 0,
        updatedProducts: updatedCount,
        cleanedImages,
        details: cleanupResults
      }
    });

  } catch (error) {
    logger.error('product_image_cleanup_error', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
