import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Get webhook statistics from the webhook_stats view
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const eventType = searchParams.get('event_type');
    const status = searchParams.get('status');
    const days = parseInt(searchParams.get('days') || '30');
    
    let query = supabase
      .from('webhook_stats')
      .select('*')
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    // Apply filters if provided
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // Order by date descending
    query = query.order('date', { ascending: false });
    
    const { data: stats, error } = await query;
    
    if (error) {
      logger.error('webhook_stats_fetch_error', { error: error.message });
      return NextResponse.json(
        { error: 'Failed to fetch webhook statistics' },
        { status: 500 }
      );
    }
    
    // Calculate summary statistics
    const summary = {
      total_events: stats?.reduce((sum, row) => sum + (row.count || 0), 0) || 0,
      success_rate: 0,
      avg_processing_time: 0,
      event_types: new Set(stats?.map(row => row.event_type) || []).size,
      date_range: {
        from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      }
    };
    
    if (stats && stats.length > 0) {
      const successEvents = stats
        .filter(row => row.status === 'processed' || row.status === 'success')
        .reduce((sum, row) => sum + (row.count || 0), 0);
      
      summary.success_rate = summary.total_events > 0 
        ? (successEvents / summary.total_events) * 100 
        : 0;
      
      const avgTimes = stats
        .filter(row => row.avg_processing_time !== null)
        .map(row => row.avg_processing_time);
      
      summary.avg_processing_time = avgTimes.length > 0
        ? avgTimes.reduce((sum, time) => sum + time, 0) / avgTimes.length
        : 0;
    }
    
    logger.info('webhook_stats_fetched', { 
      records: stats?.length || 0,
      total_events: summary.total_events,
      success_rate: summary.success_rate
    });
    
    return NextResponse.json({
      success: true,
      data: stats,
      summary,
      filters: {
        event_type: eventType,
        status,
        days
      }
    });
    
  } catch (error: any) {
    logger.error('webhook_stats_error', { error: error.message });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get specific webhook event types and their counts
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { event_types = [], days = 30 } = body;
    
    let query = supabase
      .from('webhook_stats')
      .select('event_type, status, count, avg_processing_time, date')
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    if (event_types.length > 0) {
      query = query.in('event_type', event_types);
    }
    
    const { data: stats, error } = await query.order('date', { ascending: false });
    
    if (error) {
      logger.error('webhook_stats_post_error', { error: error.message });
      return NextResponse.json(
        { error: 'Failed to fetch webhook statistics' },
        { status: 500 }
      );
    }
    
    // Group by event_type and calculate totals
    const grouped = stats?.reduce((acc: any, row) => {
      const eventType = row.event_type;
      if (!acc[eventType]) {
        acc[eventType] = {
          event_type: eventType,
          total_count: 0,
          success_count: 0,
          error_count: 0,
          avg_processing_time: 0,
          daily_stats: []
        };
      }
      
      acc[eventType].total_count += row.count || 0;
      
      if (row.status === 'processed' || row.status === 'success') {
        acc[eventType].success_count += row.count || 0;
      } else {
        acc[eventType].error_count += row.count || 0;
      }
      
      if (row.avg_processing_time) {
        acc[eventType].avg_processing_time = 
          (acc[eventType].avg_processing_time + row.avg_processing_time) / 2;
      }
      
      acc[eventType].daily_stats.push({
        date: row.date,
        status: row.status,
        count: row.count,
        avg_processing_time: row.avg_processing_time
      });
      
      return acc;
    }, {}) || {};
    
    return NextResponse.json({
      success: true,
      data: Object.values(grouped),
      total_event_types: Object.keys(grouped).length
    });
    
  } catch (error: any) {
    logger.error('webhook_stats_post_error', { error: error.message });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
