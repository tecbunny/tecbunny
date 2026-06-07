import { NextRequest, NextResponse } from 'next/server';

import { pricingService } from '@/lib/pricing-service';
import { logger } from '@/lib/logger';

// export const dynamic = 'force-dynamic';

/**
 * Calculate pricing for products based on customer context
 * POST /api/pricing/calculate
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      items, 
      customerId, 
      customerType
    } = await request.json();

    // Validate required fields and data types rigorously
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      );
    }

    // Defensive type casting for all incoming items to prevent string comparison logic failures
    const validatedItems = items.map(item => ({
      ...item,
      id: String(item.id || item.productId || ''),
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      mrp: item.mrp != null ? Number(item.mrp) : null,
      offer_price: item.offer_price != null ? Number(item.offer_price) : null
    }));

    // Get customer pricing context
    const context = await pricingService.getCustomerPricingContext(customerId);
    
    // Override context if specific customer type is provided
    if (customerType) {
      context.customer_type = String(customerType) as any;
    }

    // Calculate pricing using validated numeric inputs
    const pricing = await pricingService.calculateCartTotal(validatedItems, context);

    return NextResponse.json({
      success: true,
      pricing
    });

  } catch (error) {
    logger.error('pricing_calculate_error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get pricing for specific product
 * GET /api/pricing/calculate?productId=123&customerId=456
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const customerId = searchParams.get('customerId');
    const customerType = searchParams.get('customerType');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Get customer pricing context
    const context = await pricingService.getCustomerPricingContext(customerId || undefined);
    
    // Override context if specific customer type is provided
    if (customerType) {
      context.customer_type = customerType as any;
    }

    // Get product from database (this would need to be implemented)
    // For now, we'll return an error indicating the product needs to be fetched first
    return NextResponse.json(
      { error: 'Product pricing endpoint requires full product data. Use cart calculation instead.' },
      { status: 400 }
    );

  } catch (error) {
    logger.error('pricing_calculate_get_error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
