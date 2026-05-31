import { NextRequest } from 'next/server';

import { superfoneAPI } from '@/lib/superfone-enterprise-api';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

// export const dynamic = 'force-dynamic';

/**
 * POST /api/superfone/analytics
 * Get analytics data
 */
export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('UNAUTHORIZED', { correlationId });
    }

    const body = await request.json();
    const {
      start_date,
      end_date,
      metrics = ['calls', 'messages', 'contacts'],
      filters,
      group_by
    } = body;

    // Validate required fields
    if (!start_date || !end_date) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    const analyticsData = {
      start_date,
      end_date,
      metrics,
      filters,
      group_by
    };

    const result = await superfoneAPI.getAnalytics(analyticsData);

    return apiSuccess({
      analytics: result,
      period: {
        start_date,
        end_date
      },
      metrics,
      message: 'Analytics data retrieved successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error getting analytics', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

/**
 * GET /api/superfone/analytics/calls
 * Get call logs
 */
export async function GET(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('UNAUTHORIZED', { correlationId });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status');
    const direction = searchParams.get('direction');

    if (!startDate || !endDate) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    const filters: any = {};
    if (status) filters.status = status;
    if (direction) filters.direction = direction;

    const callLogs = await superfoneAPI.getCallLogs(startDate, endDate, filters);

    return apiSuccess({
      call_logs: callLogs,
      period: {
        start_date: startDate,
        end_date: endDate
      },
      filters,
      message: 'Call logs retrieved successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error getting call logs', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
