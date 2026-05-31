import { NextRequest, NextResponse } from 'next/server';

import { enhancedCommissionService } from '@/lib/enhanced-commission-service';
import { isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Create or update commission rules
 * POST /api/commissions/rules
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseServiceConfigured) {
      logger.error('commissions.rules.post.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const rule = await request.json();

    // Validate required fields
    if (!rule.commission_rate) {
      return NextResponse.json(
        { error: 'Commission rate is required' },
        { status: 400 }
      );
    }

    // Create commission rule
    const result = await enhancedCommissionService.createCommissionRule(rule);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      rule_id: result.rule_id,
      message: 'Commission rule created successfully'
    });

  } catch (error) {
    console.error('Error in create commission rule API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get agent commission history
 * GET /api/commissions/rules?agentId=123&startDate=2024-01-01&endDate=2024-12-31&status=paid
 */
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseServiceConfigured) {
      logger.error('commissions.rules.get.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Get agent commissions
    const commissions = await enhancedCommissionService.getAgentCommissions(
      agentId,
      startDate || undefined,
      endDate || undefined,
      status || undefined
    );

    return NextResponse.json({
      success: true,
      commissions
    });

  } catch (error) {
    console.error('Error in get commissions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
