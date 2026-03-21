import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { action, customerId } = await request.json();

    if (action === 'check-all') {
      // Run promotion check for all eligible customers
      const { data: promotions, error } = await supabase
        .rpc('check_customer_promotions');

      if (error) {
        console.error('Error checking promotions:', error);
        return NextResponse.json(
          { error: 'Failed to check customer promotions', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Promotion check completed',
        promotions: promotions || [],
        count: promotions?.length || 0
      });
    }

    if (action === 'check-customer' && customerId) {
      // Get customer's order statistics
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total, created_at, status')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        return NextResponse.json(
          { error: 'Failed to fetch customer orders', details: ordersError.message },
          { status: 500 }
        );
      }

      // Get current customer info
      const { data: customer, error: customerError } = await supabase
        .from('profiles')
        .select('id, customer_category, first_name, last_name')
        .eq('id', customerId)
        .single();

      if (customerError) {
        return NextResponse.json(
          { error: 'Failed to fetch customer info', details: customerError.message },
          { status: 500 }
        );
      }

      // Get promotion settings
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'auto_promotion_settings')
        .single();

      if (settingsError || !settings) {
        return NextResponse.json(
          { error: 'Failed to fetch promotion settings' },
          { status: 500 }
        );
      }

      const promotionSettings = settings.value as { 
        rules?: Array<{ 
          isActive: boolean; 
          fromCategory: string; 
          toCategory: string; 
          conditions: unknown;
          timeframeDays: number;
          minOrderCount: number;
          minOrderAmount: number;
        }> 
      };
      const eligiblePromotions = [];

      const normalizedOrders = (orders || []).map(order => {
        const totalValue = Number(order.total ?? 0);
        const status = typeof order.status === 'string' ? order.status : '';
        return {
          ...order,
          total: totalValue,
          status,
          status_normalized: status.toLowerCase(),
        };
      });

      const isEligibleStatus = (status: string) => {
        const normalized = status.toLowerCase();
        return ['completed', 'delivered', 'payment confirmed'].includes(normalized);
      };

      const completedOrders = normalizedOrders.filter(order => isEligibleStatus(order.status));

      // Check each rule
      for (const rule of promotionSettings.rules || []) {
        if (!rule.isActive || rule.fromCategory !== customer.customer_category) {
          continue;
        }

        // Calculate order stats for the timeframe
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - rule.timeframeDays);

        const recentOrders = completedOrders.filter(order => 
          new Date(order.created_at) >= cutoffDate
        );

        const orderCount = recentOrders.length;
        const totalAmount = recentOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);

        if (orderCount >= rule.minOrderCount && totalAmount >= rule.minOrderAmount) {
          eligiblePromotions.push({
            rule,
            orderCount,
            totalAmount,
            canPromote: true
          });
        } else {
          eligiblePromotions.push({
            rule,
            orderCount,
            totalAmount,
            canPromote: false,
            requirements: {
              needMoreOrders: Math.max(0, rule.minOrderCount - orderCount),
              needMoreAmount: Math.max(0, rule.minOrderAmount - totalAmount)
            }
          });
        }
      }

      return NextResponse.json({
        customer,
        orders: normalizedOrders.slice(0, 10), // Recent 10 orders with normalized totals
        eligiblePromotions,
        totalOrders: normalizedOrders.length
      });
    }

    if (action === 'apply-promotion' && customerId) {
      const { toCategory, fromCategory, reason } = await request.json();

      // Apply the promotion
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          customer_category: toCategory,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to apply promotion', details: updateError.message },
          { status: 500 }
        );
      }

      // Record the promotion
      const { error: recordError } = await supabase
        .from('customer_promotions')
        .insert({
          customer_id: customerId,
          from_category: fromCategory,
          to_category: toCategory,
          promotion_reason: reason || 'Manual promotion',
          order_count: 0,
          total_amount: 0,
          timeframe_days: 0,
          applied: true,
          applied_at: new Date().toISOString()
        });

      if (recordError) {
        console.error('Failed to record promotion:', recordError);
      }

      return NextResponse.json({
        message: 'Promotion applied successfully',
        customerId,
        fromCategory,
        toCategory
      });
    }

    if (action === 'get-settings') {
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'auto_promotion_settings')
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch settings', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json(settings.value);
    }

    if (action === 'update-settings') {
      const { settings } = await request.json();

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'auto_promotion_settings',
          value: settings,
          description: 'Auto-promotion system configuration',
          updated_at: new Date().toISOString()
        });

      if (error) {
        return NextResponse.json(
          { error: 'Failed to update settings', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Settings updated successfully',
        settings
      });
    }

    if (action === 'get-statistics') {
      // Get promotion statistics
      const { data: promotionStats, error: statsError } = await supabase
        .from('customer_promotions')
        .select('from_category, to_category, applied, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (statsError) {
        return NextResponse.json(
          { error: 'Failed to fetch statistics', details: statsError.message },
          { status: 500 }
        );
      }

      // Get customer category distribution
      const { data: categoryStats, error: categoryError } = await supabase
        .from('profiles')
        .select('customer_category')
        .eq('role', 'customer')
        .eq('is_active', true);

      if (categoryError) {
        return NextResponse.json(
          { error: 'Failed to fetch category stats', details: categoryError.message },
          { status: 500 }
        );
      }

      // Process statistics
      const totalPromotions = promotionStats.length;
      const appliedPromotions = promotionStats.filter(p => p.applied).length;
      const pendingPromotions = totalPromotions - appliedPromotions;

      const categoryDistribution = categoryStats.reduce((acc, customer) => {
        const category = customer.customer_category || 'Normal';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const recentPromotions = promotionStats.slice(0, 10);

      // Get last check time
      const { data: lastCheck } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'last_promotion_check')
        .single();

      return NextResponse.json({
        totalPromotions,
        appliedPromotions,
        pendingPromotions,
        categoryDistribution,
        recentPromotions,
        lastCheckTime: lastCheck?.value || null
      });
    }

    return NextResponse.json(
      { error: 'Invalid action specified' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Customer promotions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'check-eligibility') {
      const customerId = searchParams.get('customerId');
      
      if (!customerId) {
        return NextResponse.json(
          { error: 'Customer ID is required' },
          { status: 400 }
        );
      }

      // Use the same logic as the POST check-customer action
      const response = await POST(new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify({ action: 'check-customer', customerId })
      }));

      return response;
    }

    if (action === 'stats') {
      const response = await POST(new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify({ action: 'get-statistics' })
      }));

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid action specified' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Customer promotions API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
