import { NextRequest, NextResponse } from 'next/server';

import { enhancedCommissionService } from '@/lib/enhanced-commission-service';
import { isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Calculate commission for an order
 * POST /api/commissions/calculate
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseServiceConfigured) {
      logger.error('commissions.calculate.post.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const { orderId, agentId } = await request.json();

    // Validate required fields and types rigorously
    if (!orderId || !agentId) {
      return NextResponse.json(
        { error: 'Order ID and agent ID are required' },
        { status: 400 }
      );
    }

    const safeOrderId = String(orderId);
    const safeAgentId = String(agentId);

    // Calculate commission using safe string identifiers
    const result = await enhancedCommissionService.calculateOrderCommission(safeOrderId, safeAgentId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      calculation: result.calculation
    });

  } catch (error) {
    console.error('Error in commission calculation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Save commission record and award points
 * PUT /api/commissions/calculate
 */
export async function PUT(request: NextRequest) {
  try {
    if (!isSupabaseServiceConfigured) {
      logger.error('commissions.calculate.put.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const calculation = await request.json();

    // Validate required fields and types rigorously
    if (!calculation.order_id || !calculation.agent_id || calculation.commission_amount == null) {
      return NextResponse.json(
        { error: 'Calculation object with order_id, agent_id, and commission_amount is required' },
        { status: 400 }
      );
    }

    const safeCalculation = {
      ...calculation,
      order_id: String(calculation.order_id),
      agent_id: String(calculation.agent_id),
      commission_amount: Number(calculation.commission_amount) || 0,
      points_awarded: calculation.points_awarded != null ? Number(calculation.points_awarded) : undefined
    };

    // Save commission record using validated numeric inputs
    const result = await enhancedCommissionService.saveCommissionRecord(safeCalculation);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      commission_id: result.commission_id,
      message: 'Commission record saved and points awarded'
    });

  } catch (error) {
    console.error('Error in save commission API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
