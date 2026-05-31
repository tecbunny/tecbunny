import { NextRequest, NextResponse } from 'next/server';

import { pricingService } from '@/lib/pricing-service';

// export const dynamic = 'force-dynamic';

/**
 * Get customer pricing context and type
 * GET /api/pricing/customer-type?customerId=123
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Get customer pricing context
    const context = await pricingService.getCustomerPricingContext(customerId);

    return NextResponse.json({
      success: true,
      customer_type: context.customer_type,
      customer_category: context.customer_category,
      pricing_context: context
    });

  } catch (error) {
    console.error('Error in customer type API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Verify GSTIN for B2B customer upgrade
 * POST /api/pricing/customer-type
 */
export async function POST(request: NextRequest) {
  try {
    const { gstin, businessName } = await request.json();

    if (!gstin || !businessName) {
      return NextResponse.json(
        { error: 'GSTIN and business name are required' },
        { status: 400 }
      );
    }

    // Verify GSTIN
    const result = await pricingService.verifyGSTIN(gstin, businessName);

    return NextResponse.json({
      success: true,
      verification_result: result
    });

  } catch (error) {
    console.error('Error in GSTIN verification API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
