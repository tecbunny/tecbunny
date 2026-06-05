import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { 
  sendShipmentNotification,
  sendWhatsAppNotification
} from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

interface ShippingUpdateData {
  order_id: string;
  tracking_number?: string;
  carrier?: string;
  status: 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'returned';
  estimated_delivery?: string;
  delivery_address?: string;
  notes?: string;
}

// Shipping status update with WhatsApp notifications
export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(clientIP, 'shipping_updates', { limit: 10, windowMs: 60000 })) {
      return apiError('RATE_LIMITED', { correlationId });
    }

    const body: ShippingUpdateData = await request.json();
    const { 
      order_id, 
      tracking_number, 
      carrier = 'Unknown',
      status, 
      estimated_delivery,
      delivery_address,
      notes
    } = body;

    // Validate required fields
    if (!order_id || !status) {
      return apiError('VALIDATION_ERROR', { 
        correlationId, 
        overrideMessage: 'order_id and status are required' 
      });
    }

    logger.info('shipping_update_attempt', {
      order_id,
      tracking_number,
      carrier,
      status,
      correlationId
    });

    // Get order details with customer information
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, items')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      logger.error('order_not_found', { order_id, error: orderError, correlationId });
      return apiError('NOT_FOUND', { 
        correlationId, 
        overrideMessage: 'Order not found' 
      });
    }

    // Parse order items to get customer info
    const orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const customerPhone = orderItems?.customer_phone;

    // Update order status based on shipping status
    let newOrderStatus = order.status;
    if (status === 'shipped') {
      newOrderStatus = 'shipped';
    } else if (status === 'delivered') {
      newOrderStatus = 'delivered';
    } else if (status === 'returned') {
      newOrderStatus = 'returned';
    }

    // Update order with shipping information
    const orderUpdate: any = {
      status: newOrderStatus,
      updated_at: new Date().toISOString()
    };

    // Add shipping info to the items field
    const updatedOrderItems = {
      ...orderItems,
      shipping_info: {
        tracking_number,
        carrier,
        status,
        estimated_delivery,
        delivery_address,
        notes,
        updated_at: new Date().toISOString()
      }
    };

    orderUpdate.items = JSON.stringify(updatedOrderItems);

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', order_id)
      .select()
      .single();

    if (updateError) {
      logger.error('order_shipping_update_error', { order_id, error: updateError, correlationId });
      return apiError('DATABASE_ERROR', { correlationId });
    }

    logger.info('shipping_status_updated', { 
      order_id, 
      old_status: order.status, 
      new_status: newOrderStatus,
      shipping_status: status,
      tracking_number,
      correlationId 
    });

    // Send WhatsApp notifications
    if (customerPhone) {
      try {
        // Clean and format phone number
        const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

        let customerMessage = '';

        switch (status) {
          case 'shipped':
            customerMessage = `📦 Your Order Has Been Shipped! 🚚\n\n` +
              `📋 Order ID: ${order_id}\n` +
              `📦 Tracking Number: ${tracking_number || 'Will be provided soon'}\n` +
              `🚚 Carrier: ${carrier}\n` +
              `📍 Address: ${delivery_address || orderItems?.delivery_address || 'As provided'}\n` +
              `📅 Estimated Delivery: ${estimated_delivery || '3-5 business days'}\n` +
              `⏰ Shipped: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
              `Track your package and stay updated!`;
            break;

          case 'in_transit':
            customerMessage = `🚚 Your Order is On The Way!\n\n` +
              `📋 Order ID: ${order_id}\n` +
              `📦 Tracking: ${tracking_number || 'N/A'}\n` +
              `🚚 Carrier: ${carrier}\n` +
              `📅 Expected: ${estimated_delivery || 'Soon'}\n` +
              `📍 Current Status: In Transit\n` +
              `⏰ Update: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
            break;

          case 'delivered':
            customerMessage = `✅ Order Delivered Successfully! 🎉\n\n` +
              `📋 Order ID: ${order_id}\n` +
              `📦 Tracking: ${tracking_number || 'N/A'}\n` +
              `📍 Delivered to: ${delivery_address || orderItems?.delivery_address || 'Your address'}\n` +
              `📅 Delivered: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
              `Thank you for shopping with us! 🙏\n` +
              `Please rate your experience and let us know how we did!`;
            break;

          case 'returned':
            customerMessage = `↩️ Order Return Processed\n\n` +
              `📋 Order ID: ${order_id}\n` +
              `📦 Tracking: ${tracking_number || 'N/A'}\n` +
              `📄 Reason: ${notes || 'Customer request'}\n` +
              `📅 Return Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
              `Refund will be processed within 5-7 business days.`;
            break;

          default:
            customerMessage = `📋 Shipping Update for Order ${order_id}\n\n` +
              `📦 Status: ${status}\n` +
              `🚚 Carrier: ${carrier}\n` +
              `📅 Update: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
        }

        // Add notes if provided
        if (notes) {
          customerMessage += `\n\n📝 Note: ${notes}`;
        }

        // Send to customer using shipping notification template
        if (tracking_number && status === 'shipped') {
          await sendShipmentNotification(formattedPhone, {
            orderNumber: order_id,
            trackingNumber: tracking_number,
            carrier,
            customerName: order.customer_name
          });
        } else {
          await sendWhatsAppNotification(formattedPhone, customerMessage);
        }

        logger.info('shipping_whatsapp_customer_sent', { 
          order_id, 
          phone: formattedPhone,
          status,
          tracking_number,
          correlationId 
        });

        // Notify manager about shipping update
        const managerPhone = process.env.MANAGER_WHATSAPP_NUMBER;
        if (managerPhone) {
          const managerMessage = `📦 Shipping Update\n\n` +
            `📋 Order: ${order_id}\n` +
            `👤 Customer: ${order.customer_name}\n` +
            `📱 Phone: ${formattedPhone}\n` +
            `📦 Status: ${status.toUpperCase()}\n` +
            `🚚 Carrier: ${carrier}\n` +
            `📦 Tracking: ${tracking_number || 'N/A'}\n` +
            `📍 Address: ${delivery_address || 'As provided'}\n` +
            `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

          await sendWhatsAppNotification(managerPhone, managerMessage);

          logger.info('shipping_whatsapp_manager_sent', { 
            order_id, 
            managerPhone,
            status,
            correlationId 
          });
        }

        // Notify admin if important status update
        if (['delivered', 'returned'].includes(status)) {
          const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
          if (adminPhone && adminPhone !== managerPhone) {
            const adminMessage = `📋 Order ${status.toUpperCase()}\n\n` +
              `🆔 ${order_id}\n` +
              `👤 ${order.customer_name}\n` +
              `💰 ₹${order.total}\n` +
              `📦 ${tracking_number || 'No tracking'}\n` +
              `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

            await sendWhatsAppNotification(adminPhone, adminMessage);

            logger.info('shipping_whatsapp_admin_sent', { 
              order_id, 
              adminPhone,
              status,
              correlationId 
            });
          }
        }

      } catch (whatsappError) {
        logger.warn('shipping_whatsapp_failure', { 
          order_id, 
          error: whatsappError instanceof Error ? whatsappError.message : 'unknown',
          correlationId 
        });
        // Don't fail the shipping update if WhatsApp fails
      }
    }

    return apiSuccess({
      order_id,
      shipping_status: status,
      order_status: newOrderStatus,
      tracking_number,
      carrier,
      estimated_delivery,
      updated_at: updatedOrder.updated_at
    }, correlationId);

  } catch (error) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('shipping_update_error', { error, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

// Get shipping status for an order
export async function GET(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const { searchParams } = new URL(request.url);
    const order_id = searchParams.get('order_id');

    if (!order_id) {
      return apiError('VALIDATION_ERROR', { 
        correlationId, 
        overrideMessage: 'order_id parameter is required' 
      });
    }

    const supabase = await createClient();
    
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, status, items, created_at, updated_at')
      .eq('id', order_id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      logger.error('shipping_status_lookup_error', { error, order_id, correlationId });
      return apiError('DATABASE_ERROR', { correlationId });
    }

    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found',
        order: null
      }, { status: 404 });
    }

    // Parse shipping info from items
    const orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const shippingInfo = orderItems?.shipping_info || {};

    return apiSuccess({
      order_id: order.id,
      order_status: order.status,
      shipping_info: {
        tracking_number: shippingInfo.tracking_number || null,
        carrier: shippingInfo.carrier || null,
        status: shippingInfo.status || 'pending',
        estimated_delivery: shippingInfo.estimated_delivery || null,
        delivery_address: shippingInfo.delivery_address || null,
        notes: shippingInfo.notes || null,
        updated_at: shippingInfo.updated_at || null
      },
      created_at: order.created_at,
      updated_at: order.updated_at
    }, correlationId);

  } catch (error) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('shipping_status_lookup_error', { error, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
