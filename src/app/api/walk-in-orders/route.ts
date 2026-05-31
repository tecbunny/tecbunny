import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { logger } from '@/lib/logger';
import { requireApiRole, type RoleCheckOptions } from '@/lib/server-role-guard';

const WALK_IN_ACCESS: RoleCheckOptions = {
  allowedRoles: ['sales', 'manager'],
  minimumRole: 'admin'
};

const resolveOrderTotal = (order: Record<string, any>) => {
  const candidates = [order?.total, order?.total_amount, order?.amount, order?.grand_total];
  for (const value of candidates) {
    const parsed = parseFloat(String(value ?? ''));
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const normalizeStatus = (status?: string) => status?.toLowerCase().trim() ?? '';

const isPaidStatus = (status?: string) => {
  const normalized = normalizeStatus(status);
  return [
    'payment confirmed',
    'completed',
    'delivered',
    'fulfilled',
    'paid'
  ].some((value) => normalized === value);
};

const isPendingPaymentStatus = (status?: string) => {
  const normalized = normalizeStatus(status);
  return [
    'awaiting payment',
    'pending',
    'processing',
    'payment pending'
  ].some((value) => normalized === value);
};

const mapPaymentStatusToOrderStatus = (paymentStatus?: string) => {
  const normalized = normalizeStatus(paymentStatus);
  if (normalized === 'paid') {
    return 'Payment Confirmed';
  }
  if (normalized === 'failed') {
    return 'Payment Failed';
  }
  if (normalized === 'pending') {
    return 'Awaiting Payment';
  }
  return undefined;
};

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiRole(WALK_IN_ACCESS);
    if ('error' in access) {
      return access.error;
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'store-orders') {
      const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
      
      // Fetch orders without problematic joins
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .or('type.eq.Walk-in,type.eq.Pickup')
        .gte('created_at', `${date}T00:00:00`)
        .lt('created_at', `${date}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch store orders', details: { message: error.message } },
          { status: 500 }
        );
      }

      // Get order items separately for each order
      const ordersWithItems = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);
          
          return {
            ...order,
            order_items: items || []
          };
        })
      );

      return NextResponse.json({ orders: ordersWithItems });
    }

    if (action === 'daily-stats') {
      const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total, status')
        .or('type.eq.Walk-in,type.eq.Pickup')
        .gte('created_at', `${date}T00:00:00`)
        .lt('created_at', `${date}T23:59:59`);

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch daily stats', details: { message: error.message } },
          { status: 500 }
        );
      }

      const stats = {
        totalOrders: orders?.length || 0,
        totalRevenue:
          orders?.reduce(
            (sum: number, order: { total: string | number; total_amount?: string | number; amount?: string | number }) =>
              sum + resolveOrderTotal(order),
            0
          ) || 0,
        completedOrders: orders?.filter((order: { status: string }) => normalizeStatus(order.status) === 'completed').length || 0,
        pendingOrders: orders?.filter((order: { status: string }) => normalizeStatus(order.status) === 'pending').length || 0,
        paidOrders: orders?.filter((order: { status: string }) => isPaidStatus(order.status)).length || 0,
        pendingPayments: orders?.filter((order: { status: string }) => isPendingPaymentStatus(order.status)).length || 0
      };

      return NextResponse.json({ stats });
    }

    if (action === 'customer-orders') {
      const customerId = searchParams.get('customerId');
      const customerPhone = searchParams.get('phone');
      
      if (!customerId && !customerPhone) {
        return NextResponse.json(
          { error: 'Customer ID or phone number is required' },
          { status: 400 }
        );
      }

      let query = supabase
        .from('orders')
        .select('*')
        .or('type.eq.Walk-in,type.eq.Pickup')
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      } else if (customerPhone) {
        query = query.eq('customer_phone', customerPhone);
      }

      const { data: orders, error } = await query;

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch customer orders', details: { message: error.message } },
          { status: 500 }
        );
      }

      return NextResponse.json({ orders });
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    );

  } catch (error) {
    logger.error('Walk-in orders API error:', { error });
    return NextResponse.json(
      { error: 'Internal server error', details: { message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

// Export a simple POST function for creating orders
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiRole(WALK_IN_ACCESS);
    if ('error' in access) {
      return access.error;
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { action, ...data } = await request.json();

    if (action === 'update-order-status') {
      const { orderId, status, paymentStatus } = data;

      if (!orderId) {
        return NextResponse.json(
          { error: 'Order ID is required' },
          { status: 400 }
        );
      }

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (status) {
        updates.status = status;
      } else if (paymentStatus) {
        const derivedStatus = mapPaymentStatusToOrderStatus(paymentStatus);
        if (derivedStatus) {
          updates.status = derivedStatus;
        }
      }

      if (!updates.status) {
        return NextResponse.json(
          { error: 'No valid status provided for update' },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) {
        logger.error('Failed to update order status', { error, context: 'walk-in-orders.update-order-status', orderId, updates });
        return NextResponse.json(
          { error: 'Failed to update order', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'create-order') {
      const { customer_name, customer_email, customer_phone, items, payment_method, notes } = data;
      
      // Calculate totals
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const gst_amount = subtotal * 0.18; // 18% GST
      const total = subtotal + gst_amount;

      // Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name,
          customer_email,
          customer_phone,
          status: 'Pending',
          type: 'Walk-in',
          subtotal,
          gst_amount,
          total,
          payment_method,
          notes,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (orderError) {
        return NextResponse.json(
          { error: 'Failed to create order', details: orderError.message },
          { status: 500 }
        );
      }

      // Create order items
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        gst_rate: 18
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        // Rollback order if items creation fails
        await supabase.from('orders').delete().eq('id', order.id);
        return NextResponse.json(
          { error: 'Failed to create order items', details: itemsError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ order, items: orderItems });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    logger.error('Walk-in orders POST error:', { error });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
