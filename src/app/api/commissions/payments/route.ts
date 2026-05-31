import { NextRequest, NextResponse } from 'next/server';

import { enhancedCommissionService } from '@/lib/enhanced-commission-service';

/**
 * Process commission payments
 * POST /api/commissions/payments
 */
export async function POST(request: NextRequest) {
  try {
    const { commissionIds, paymentDetails } = await request.json();

    // Validate required fields
    if (!commissionIds || !Array.isArray(commissionIds) || commissionIds.length === 0) {
      return NextResponse.json(
        { error: 'Commission IDs array is required' },
        { status: 400 }
      );
    }

    if (!paymentDetails || !paymentDetails.payment_method) {
      return NextResponse.json(
        { error: 'Payment details with payment_method are required' },
        { status: 400 }
      );
    }

    // Process commission payment
    const result = await enhancedCommissionService.processCommissionPayment(
      commissionIds,
      paymentDetails
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      processed_count: result.processed_count,
      message: `Successfully processed ${result.processed_count} commission payments`
    });

  } catch (error) {
    console.error('Error in process commission payment API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
