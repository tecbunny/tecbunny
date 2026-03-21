import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin-auth';
import { logger } from '../../../../lib/logger';

/**
 * Quick fix endpoint to add placeholder images to products without images
 * POST /api/products/fix-images
 * 
 * This will add appropriate product images based on category
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authorization
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const { isAdmin, error: authError, status } = await requireAdmin(user, supabaseAuth);
    if (!isAdmin) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: status || 403 });
    }

    const supabase = createServiceClient();
    const body = await request.json();
    const dryRun = body.dryRun !== false; // Default to dry run for safety

    // Fetch products without valid main images
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, title, name, image, category, product_type')
      .or('image.is.null,image.eq.')
      .limit(100);

    if (fetchError) {
      logger.error('fix_images_fetch_error', { error: fetchError.message });
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products need image fixes',
        updated: 0
      });
    }

    // Category-specific placeholder images (you can customize these)
    const categoryImages: Record<string, string> = {
      'CCTV': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&h=400&fit=crop',
      'Camera': 'https://images.unsplash.com/photo-1520390138845-fd2d229dd553?w=600&h=400&fit=crop',
      'DVR': 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&h=400&fit=crop',
      'NVR': 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&h=400&fit=crop',
      'Security': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&h=400&fit=crop',
      'Surveillance': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&h=400&fit=crop',
      'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&h=400&fit=crop',
      'default': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop'
    };

    const updates: any[] = [];
    const previews: any[] = [];

    for (const product of products) {
      const category = product.category || product.product_type || 'default';
      const productName = product.title || product.name || 'Product';
      
      // Find matching category image or use default
      let imageUrl = categoryImages['default'];
      for (const [key, url] of Object.entries(categoryImages)) {
        if (category.toLowerCase().includes(key.toLowerCase())) {
          imageUrl = url;
          break;
        }
      }

      previews.push({
        id: product.id,
        name: productName,
        category,
        currentImage: product.image || 'none',
        newImage: imageUrl
      });

      if (!dryRun) {
        updates.push({
          id: product.id,
          image: imageUrl
        });
      }
    }

    let updateCount = 0;
    if (!dryRun && updates.length > 0) {
      // Update products in batches
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ image: update.image })
          .eq('id', update.id);

        if (updateError) {
          logger.error('fix_images_update_error', { 
            productId: update.id, 
            error: updateError.message 
          });
        } else {
          updateCount++;
        }
      }

      logger.info('fix_images_completed', { 
        totalFound: products.length, 
        updated: updateCount 
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun 
        ? `Found ${products.length} products that need images. Run with dryRun=false to apply fixes.`
        : `Successfully updated ${updateCount} out of ${products.length} products`,
      totalFound: products.length,
      updated: updateCount,
      previews: previews.slice(0, 10), // Show first 10 for preview
      instructions: dryRun 
        ? 'To apply these fixes, send POST request with body: {"dryRun": false}'
        : 'Images have been updated. Refresh your products page to see changes.'
    });

  } catch (error: any) {
    logger.error('fix_images_error', { error: error?.message });
    return NextResponse.json(
      { error: 'Fix images failed', details: error?.message },
      { status: 500 }
    );
  }
}
