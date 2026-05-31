import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient, createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { 
  sendWhatsAppNotification, 
  sendOutForDeliveryNotification, 
  sendPaymentConfirmationNotification,
  sendOrderCancelled,
  sendOrderDelayed,
  sendOrderActionNeeded,
  sendOrderPickupReady,
  sendPaymentActionRequired,
  sendDeliveryConfirmation
} from '@/lib/whatsapp-service';
import { otpService } from '@/lib/otp-service';
import { isAtLeast } from '@/lib/roles';
import type { OrderStatus, UserRole } from '@/lib/types';

const STATUS_NORMALIZATION: Record<string, OrderStatus> = {
  pending: 'Pending',
  'awaiting payment': 'Awaiting Payment',
  'payment confirmed': 'Payment Confirmed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  'ready to ship': 'Ready to Ship',
  shipped: 'Shipped',
  'ready for pickup': 'Ready for Pickup',
  'ready for delivery': 'Ready for Delivery',
  delivered: 'Delivered',
  'delivered/picked up': 'Delivered/Picked Up',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  'on hold': 'On Hold',
  'visit scheduled': 'Visit Scheduled',
  'visit complete': 'Visit Completed',
  'visit completed': 'Visit Completed',
  'diagnosis done': 'Diagnosis Done',
  'quote sent': 'Quote Sent',
  'awaiting customer approval': 'Awaiting Customer Approval',
  approved: 'Approved',
  'parts ordered': 'Parts Ordered',
  'work in progress': 'Work In Progress',
  wip: 'Work In Progress',
  'quality check': 'Quality Check',
  qc: 'Quality Check',
  'warranty/support active': 'Warranty/Support Active',
};

const GENERAL_ORDER_STATUS_SET = new Set<OrderStatus>([
  'Pending',
  'Awaiting Payment',
  'Payment Confirmed',
  'Confirmed',
  'Processing',
  'Ready to Ship',
  'Shipped',
  'Ready for Pickup',
  'Completed',
  'Delivered',
  'Cancelled',
  'Rejected',
]);

const SERVICE_ORDER_STATUS_SET = new Set<OrderStatus>([
  'Pending',
  'Awaiting Payment',
  'Payment Confirmed',
  'Visit Scheduled',
  'Visit Completed',
  'Diagnosis Done',
  'Quote Sent',
  'Awaiting Customer Approval',
  'Approved',
  'Rejected',
  'On Hold',
  'Parts Ordered',
  'Work In Progress',
  'Quality Check',
  'Ready for Pickup',
  'Ready for Delivery',
  'Delivered/Picked Up',
  'Completed',
  'Warranty/Support Active',
  'Cancelled',
]);

const SERVICE_TYPE_SET = new Set(['service', 'repair', 'installation', 'setup']);

const PICKUP_TYPE_SET = new Set(['pickup', 'walk-in', 'walkin', 'walk in', 'walk_in']);

const ALLOWED_MUTABLE_FIELDS = new Set([
  'cancellation_reason',
  'payment_reference',
  'notes',
  'shipping_amount',
  'discount_amount',
]);

interface UpdateStatusPayload {
  orderId?: unknown;
  status?: unknown;
  additionalData?: unknown;
}

function normalizeStatus(value: unknown): OrderStatus | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const key = value.trim().toLowerCase();
  return STATUS_NORMALIZATION[key] ?? (value as OrderStatus);
}

function sanitizeAdditionalData(raw: unknown) {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_MUTABLE_FIELDS.has(key)) continue;

    if (key === 'cancellation_reason' || key === 'notes' || key === 'payment_reference') {
      if (typeof val === 'string' && val.trim()) {
        result[key] = val.trim();
      }
      continue;
    }

    if (key === 'shipping_amount' || key === 'discount_amount') {
      const numeric = typeof val === 'number' ? val : Number(val);
      if (Number.isFinite(numeric)) {
        result[key] = Math.round(numeric * 100) / 100;
      }
      continue;
    }
  }
  return result;
}

function resolvePaymentStatusUpdate(order: { payment_status?: string | null; payment_method?: string | null }, newStatus: OrderStatus) {
  const method = (order.payment_method ?? '').toLowerCase();
  switch (newStatus) {
    case 'Awaiting Payment':
      return { payment_status: 'Payment Confirmation Pending' };
    case 'Payment Confirmed':
      return { payment_status: 'Payment Confirmed' };
    case 'Confirmed':
      if (method === 'cod') return {};
      if ((order.payment_status ?? '').toLowerCase() === 'payment confirmed') return {};
      return { payment_status: 'Payment Confirmed' };
    case 'Processing':
    case 'Ready to Ship':
    case 'Ready for Pickup':
    case 'Shipped':
    case 'Completed':
    case 'Delivered':
      if (method === 'cod') return {};
      return { payment_status: 'Payment Confirmed' };
    case 'Cancelled':
    case 'Rejected':
      return { payment_status: 'Payment Cancelled' };
    default:
      return {};
  }
}

// export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as UpdateStatusPayload;
    const orderIdRaw = payload?.orderId;
    const statusRaw = payload?.status;
    const additionalRaw = payload?.additionalData;

    if (typeof orderIdRaw !== 'string' || !orderIdRaw.trim()) {
      return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
    }

    const normalizedStatus = normalizeStatus(statusRaw);
    if (!normalizedStatus) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const orderId = orderIdRaw.trim();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = (profile?.role as UserRole | undefined)
      ?? ((user.app_metadata as Record<string, unknown> | undefined)?.role as UserRole | undefined)
      ?? 'customer';

    
    const { data: orderRecord, error: fetchError } = await serviceClient
      .from('orders')
      .select('id, type, payment_status, payment_method, status, customer_phone, customer_name, total, customer_id')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchError) {
      logger.error('order_update_status_fetch_error', { error: fetchError.message, orderId });
      return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
    }

    if (!orderRecord) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const typeKey = (orderRecord.type ?? '').toString().trim().toLowerCase();
    const isServiceOrder = SERVICE_TYPE_SET.has(typeKey);
    const needsPickupRole = PICKUP_TYPE_SET.has(typeKey);
    const requiredRole: UserRole = needsPickupRole ? 'sales' : 'manager';

    const allowedStatuses = isServiceOrder ? SERVICE_ORDER_STATUS_SET : GENERAL_ORDER_STATUS_SET;
    if (!allowedStatuses.has(normalizedStatus)) {
      return NextResponse.json({ error: 'Status not allowed for this order type' }, { status: 400 });
    }

    const isCustomer = role === 'customer';
    const isCustomerCancel = isCustomer && normalizedStatus === 'Cancelled';

    if (isCustomer) {
      if (!isCustomerCancel) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!orderRecord.customer_id || orderRecord.customer_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (orderRecord.status !== 'Pending') {
        return NextResponse.json({ error: 'Order can no longer be cancelled' }, { status: 400 });
      }
    } else if (!isAtLeast(role, requiredRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatePayload: Record<string, unknown> = {
      status: normalizedStatus,
      processed_by: user.id,
      updated_at: new Date().toISOString(),
      ...resolvePaymentStatusUpdate(orderRecord, normalizedStatus),
      ...sanitizeAdditionalData(additionalRaw),
    };

    if (normalizedStatus === 'Cancelled' || normalizedStatus === 'Rejected') {
      if (typeof updatePayload.cancellation_reason !== 'string' || !updatePayload.cancellation_reason) {
        updatePayload.cancellation_reason = isCustomerCancel ? 'Cancelled by customer' : 'Cancelled via admin portal';
      }
      updatePayload.cancelled_at = new Date().toISOString();
      updatePayload.cancelled_by = user.id;
    }

    const { error: updateError } = await serviceClient
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updateError) {
      logger.error('order_update_status_failed', {
        error: updateError.message,
        orderId,
        status: normalizedStatus,
      });
      return NextResponse.json({ error: updateError.message || 'Failed to update order' }, { status: 500 });
    }

    logger.info('order_update_status_success', {
      orderId,
      status: normalizedStatus,
      by: user.id,
    });

    // Send WhatsApp notification
    if (orderRecord.customer_phone) {
      await sendOrderStatusUpdateWhatsApp(orderRecord.customer_phone, {
        orderId: orderRecord.id,
        status: normalizedStatus,
        customerName: orderRecord.customer_name,
        amount: orderRecord.total,
        currency: 'INR',
        cancelReason: updatePayload.cancellation_reason as string
      });
    }

    return NextResponse.json({ success: true, orderId, status: normalizedStatus });
  } catch (error) {
    logger.error('order_update_status_unhandled', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendOrderStatusUpdateWhatsApp(phoneNumber: string, data: any) {
  
  try {
    let message = '';
    const { orderId, status, customerName, amount, currency, cancelReason } = data;
    const namePrefix = customerName ? `Hi ${customerName}! ` : '';
    const priceDisplay = amount ? `(${currency || 'INR'} ${amount})` : '';

    switch (status) {
      case 'Awaiting Payment':
        await sendPaymentActionRequired(phoneNumber, {
          customerName,
          amount: `${currency || 'INR'} ${amount}`,
          orderNumber: orderId,
          paymentLink: `https://tecbunny.com/orders/${orderId}`
        });
        logger.info('Payment action WhatsApp sent:', { phoneNumber, orderId });
        return;

      case 'Cancelled':
      case 'Rejected':
        await sendOrderCancelled(phoneNumber, {
          customerName,
          orderNumber: orderId,
          reason: cancelReason || 'Order cancelled'
        });
        logger.info('Order cancelled WhatsApp sent:', { phoneNumber, orderId });
        return; // Exit as template handles it

      case 'On Hold':
        await sendOrderDelayed(phoneNumber, {
          customerName,
          orderNumber: orderId
        });
        logger.info('Order delayed WhatsApp sent:', { phoneNumber, orderId });
        return;

      case 'Awaiting Customer Approval':
        await sendOrderActionNeeded(phoneNumber, {
          customerName,
          orderNumber: orderId,
          actionLink: `https://tecbunny.com/account/orders/${orderId}`
        });
        logger.info('Order action needed WhatsApp sent:', { phoneNumber, orderId });
        return;
        
      case 'Ready for Pickup':
         // Generate OTP/Code
         const otpResult = await otpService.generateOtp({
           order_id: orderId,
           customer_phone: phoneNumber,
           otp_type: 'pickup', // Ensure 'pickup' is a valid OtpType or just string if typed loosely
           created_by: 'system'
         } as any, true); // true = skip SMS

         const pickupCode = otpResult.otp_code || 'CODE-PENDING';

         // Update order record with pickup_code immediately so frontend sees it
         await supabase.from('orders').update({
             pickup_code: pickupCode
         }).eq('id', orderId);

         await sendOrderPickupReady(phoneNumber, {
           customerName,
           orderNumber: orderId,
           pickupCode: pickupCode
         });
         logger.info('Order pickup ready WhatsApp sent:', { phoneNumber, orderId });
         return;

      case 'Ready for Delivery':
        await sendOutForDeliveryNotification(phoneNumber, {
          orderNumber: orderId,
          customerName: customerName
        });
        logger.info('Out for delivery WhatsApp sent:', { phoneNumber, orderId });
        break;

      case 'Payment Confirmed':
        await sendPaymentConfirmationNotification(phoneNumber, {
          customerName: customerName,
          amount: `${currency || 'INR'} ${amount}`,
          orderNumber: orderId
        });
        logger.info('Payment confirmed WhatsApp sent:', { phoneNumber, orderId });
        break;
      case 'Delivered':
      case 'Delivered/Picked Up':
      case 'Completed':
        await sendDeliveryConfirmation(phoneNumber, {
          customerName,
          orderNumber: orderId
        });
        logger.info('Delivery confirmation WhatsApp sent:', { phoneNumber, orderId });
        return;
      // Default generic update
      default:
        message = `
🔔 Order Status Update - TecBunny Store

${namePrefix}Your order status has been updated.

📦 Order: ${orderId}
🔄 New Status: ${status}

Track full details here: https://tecbunny.com/orders/${orderId}

Need help? Reply to this message.
Thank you! 🚀
        `.trim();
        break;
    }

    if (message) {
      await sendWhatsAppNotification(phoneNumber, message);
      logger.info('Order status WhatsApp sent:', { phoneNumber, orderId, status });
    }
  } catch (error: any) {
    logger.error('Failed to send order status WhatsApp:', { error: error.message });
  }
}
