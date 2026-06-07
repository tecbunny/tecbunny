import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

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

const walkInOrderItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  name: z.string().optional(),
  productName: z.string().optional(),
  quantity: z.coerce.number().int().positive().max(1000)
}).refine((item) => item.product_id || item.productId, {
  message: 'Product ID is required'
});

const createWalkInOrderSchema = z.object({
  customer_name: z.string().optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  customer_phone: z.string().optional(),
  customerInfo: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional()
  }).optional(),
  items: z.array(walkInOrderItemSchema).min(1).max(100),
  payment_method: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().max(2000).optional().nullable()
});

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

    if (action === 'create-order' || action === 'create-walk-in-order') {
      const parsedOrder = createWalkInOrderSchema.safeParse(data);
      if (!parsedOrder.success) {
        return NextResponse.json(
          { error: 'Invalid order payload', details: parsedOrder.error.flatten() },
          { status: 400 }
        );
      }

      const {
        customerInfo,
        items,
        payment_method,
        paymentMethod,
        notes
      } = parsedOrder.data;
      const customer_name = parsedOrder.data.customer_name
        || [customerInfo?.firstName, customerInfo?.lastName].filter(Boolean).join(' ').trim()
        || 'Walk-in Customer';
      const customer_email = parsedOrder.data.customer_email || customerInfo?.email || null;
      const customer_phone = parsedOrder.data.customer_phone || customerInfo?.phone || null;
      const delivery_address = customerInfo?.address || null;
      const resolvedPaymentMethod = payment_method || paymentMethod || null;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'No items in order' }, { status: 400 });
      }

      // Look up and verify item base rates on the server side using canonical database values
      const normalizedItems = items.map((item) => ({
        product_id: item.product_id || item.productId,
        name: item.name || item.productName,
        quantity: item.quantity
      }));
      const productIds = [...new Set(normalizedItems.map((item) => item.product_id).filter(Boolean))];
      const { data: dbProducts, error: dbError } = await supabase
        .from('products')
        .select('id, name, title, price, gst_rate, gst_percentage')
        .in('id', productIds);

      if (dbError || !dbProducts) {
        logger.error('walk_in_order.product_lookup_failed', { error: dbError, productIds });
        return NextResponse.json({ error: 'Failed to validate products' }, { status: 500 });
      }

      let subtotal = 0; // exclusive subtotal
      let gst_amount = 0;
      const validatedItems = [];

      for (const clientItem of normalizedItems) {
        const dbProduct = dbProducts.find((p: any) => p.id === clientItem.product_id);
        if (!dbProduct) {
          return NextResponse.json({ error: `Product not found: ${clientItem.product_id}` }, { status: 400 });
        }

        const price = dbProduct.price; // server price (inclusive)
        const gstRateRaw = dbProduct.gst_rate ?? dbProduct.gst_percentage ?? 18;
        const gstRate = typeof gstRateRaw === 'number' ? gstRateRaw : parseFloat(gstRateRaw) || 18;

        const itemInclusiveTotal = price * clientItem.quantity;
        const itemBase = itemInclusiveTotal / (1 + (gstRate / 100));
        const itemGst = itemInclusiveTotal - itemBase;

        subtotal += itemBase;
        gst_amount += itemGst;

        validatedItems.push({
          id: clientItem.product_id,
          product_id: clientItem.product_id,
          name: (dbProduct as any).name || (dbProduct as any).title || clientItem.name || 'Product',
          quantity: clientItem.quantity,
          price, // enforce server price
          gst_rate: gstRate
        });
      }

      const total = subtotal + gst_amount; // inclusive total

      const rpcItems = validatedItems.map((item) => ({
        id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        gst_rate: item.gst_rate
      }));

      const { data: rpcResult, error: rpcError } = await supabase.rpc('allocate_order_inventory_atomic', {
        p_customer_name: customer_name,
        p_customer_id: null,
        p_customer_email: customer_email,
        p_customer_phone: customer_phone,
        p_delivery_address: delivery_address,
        p_notes: notes || null,
        p_payment_method: resolvedPaymentMethod,
        p_subtotal: Math.round(subtotal * 100) / 100,
        p_gst_amount: Math.round(gst_amount * 100) / 100,
        p_total: Math.round(total * 100) / 100,
        p_discount_amount: 0,
        p_shipping_amount: 0,
        p_payment_status: null,
        p_order_type: 'Walk-in',
        p_items: rpcItems,
        p_agent_id: access.session?.user?.id || null
      });

      if (rpcError) {
        logger.error('walk_in_order.atomic_create_failed', { error: rpcError, productIds });
        const message = rpcError.message || 'Failed to allocate stock and create order';
        const status = message.toLowerCase().includes('insufficient stock') ? 409 : 500;
        return NextResponse.json(
          { error: 'Failed to create order', details: message },
          { status }
        );
      }

      const createdOrder = rpcResult?.order;
      if (!rpcResult?.success || !createdOrder?.id) {
        logger.error('walk_in_order.atomic_create_invalid_response', { rpcResult });
        return NextResponse.json(
          { error: 'Failed to create order', details: 'Invalid allocation engine response' },
          { status: 500 }
        );
      }

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', createdOrder.id)
        .single();

      // Keep the reporting table in sync for existing admin views. Inventory and order creation
      // have already completed atomically inside PostgreSQL.
      const orderItems = validatedItems.map((item: any) => ({
        order_id: createdOrder.id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price, // verified server price
        gst_rate: item.gst_rate
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        logger.warn('walk_in_order.order_items_mirror_failed', {
          error: itemsError,
          orderId: createdOrder.id
        });
      }

      return NextResponse.json({ order: order || createdOrder, items: orderItems });
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
