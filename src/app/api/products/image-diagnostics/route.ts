import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { isValidImageUrl } from '@/lib/image-utils';
import { logger } from '@/lib/logger';

/**
 * Diagnostic endpoint to check product image status
 * GET /api/products/image-diagnostics
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Fetch products with image fields
    const { data: products, error } = await supabase
      .from('products')
      .select('id, title, name, image, images, additional_images')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('image_diagnostics_fetch_error', { error: error.message });
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    // Analyze each product's image status
    const diagnostics = products?.map(product => {
      const issues: string[] = [];
      const validImages: string[] = [];
      
      // Check main image
      if (!product.image) {
        issues.push('No main image field');
      } else if (!isValidImageUrl(product.image)) {
        issues.push(`Invalid main image: "${product.image}"`);
      } else {
        validImages.push(product.image);
      }
      
      // Check images array
      if (Array.isArray(product.images)) {
        const validFromImages = product.images.filter((img: any) => {
          const url = typeof img === 'string' ? img : img?.url;
          return url && isValidImageUrl(url);
        });
        
        if (validFromImages.length === 0 && product.images.length > 0) {
          issues.push(`Images array has ${product.images.length} items but none are valid`);
        } else {
          validImages.push(...validFromImages.map((img: any) => 
            typeof img === 'string' ? img : img.url
          ));
        }
      }
      
      // Check additional_images array
      if (Array.isArray(product.additional_images)) {
        const validFromAdditional = product.additional_images.filter((img: any) => {
          const url = typeof img === 'string' ? img : img?.url;
          return url && isValidImageUrl(url);
        });
        
        if (validFromAdditional.length === 0 && product.additional_images.length > 0) {
          issues.push(`Additional images array has ${product.additional_images.length} items but none are valid`);
        } else {
          validImages.push(...validFromAdditional.map((img: any) => 
            typeof img === 'string' ? img : img.url
          ));
        }
      }
      
      return {
        id: product.id,
        title: product.title || product.name || 'Untitled',
        hasValidImages: validImages.length > 0,
        validImageCount: validImages.length,
        issues: issues.length > 0 ? issues : ['No issues'],
        mainImage: product.image || null,
        imagesArray: product.images || null,
        additionalImages: product.additional_images || null,
        firstValidImage: validImages[0] || null
      };
    }) || [];

    // Summary statistics
    const totalProducts = diagnostics.length;
    const productsWithImages = diagnostics.filter(d => d.hasValidImages).length;
    const productsWithoutImages = totalProducts - productsWithImages;
    
    const summary = {
      totalProducts,
      productsWithImages,
      productsWithoutImages,
      percentageWithImages: totalProducts > 0 ? Math.round((productsWithImages / totalProducts) * 100) : 0,
      commonIssues: {} as Record<string, number>
    };
    
    // Count common issues
    diagnostics.forEach(d => {
      d.issues.forEach(issue => {
        summary.commonIssues[issue] = (summary.commonIssues[issue] || 0) + 1;
      });
    });

    return NextResponse.json({
      success: true,
      summary,
      products: diagnostics,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('image_diagnostics_error', { error: error?.message });
    return NextResponse.json(
      { error: 'Diagnostic check failed', details: error?.message },
      { status: 500 }
    );
  }
}
