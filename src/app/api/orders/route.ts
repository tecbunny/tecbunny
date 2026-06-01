import { NextRequest } from 'next/server';

import { createClient as createServerClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { resolveSiteUrl } from '@/lib/site-url';
import { apiError, apiSuccess } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { 
  sendOrderConfirmationTemplate,
  sendWhatsAppTemplate
} from '@/lib/superfone-whatsapp-service';
import { otpService } from '@/lib/otp-service';
import { enhancedCommissionService } from '@/lib/enhanced-commission-service';
import { emailHelpers } from '@/lib/email';
import { GST_RATE } from '@/lib/constants';

const RATE_LIMIT = 5; // 5 orders
const RATE_WINDOW_MS = 60 * 1000; // per minute

export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
  const supabase = await createServerClient();
  const serviceSupabase = isSupabaseServiceConfigured ? createServiceClient() : await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiError('UNAUTHORIZED', { correlationId, overrideMessage: 'Authentication required' });
    }

    // Rate limit by user id
  if (!rateLimit(user.id, 'api_orders_create', { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS })) {
      logger.warn('orders_rate_limited', { userId: user.id });
      return apiError('RATE_LIMITED', { correlationId });
    }

    const orderData = await request.json();

  logger.info('order_create_attempt', { userId: user.id });

    // Validate required fields
    if (!orderData.customer_name || !orderData.customer_email || !orderData.customer_phone) {
      return apiError('VALIDATION_ERROR', { correlationId, overrideMessage: 'Missing required customer information' });
    }

    // Security: Recalculate totals server-side to prevent price tampering
    const itemIds = (orderData.items || [])
      .map((item: any) => item.id || item.productId)
      .filter((id: any) => typeof id === 'string' && id.length > 0);

    if (itemIds.length === 0) {
      return apiError('VALIDATION_ERROR', { correlationId, overrideMessage: 'No valid items in order' });
    }

    const { data: dbProducts, error: productsError } = await serviceSupabase
      .from('products')
      .select('id, price, stock_quantity, gst_rate, gst_percentage')
      .in('id', itemIds);

    if (productsError || !dbProducts) {
       logger.error('order_product_validation_failed', { error: productsError, itemIds });
       return apiError('INTERNAL_ERROR', { correlationId, overrideMessage: 'Failed to validate products' });
    }

    let calculatedSubtotal = 0; // Inclusive subtotal
    let calculatedExclusiveSubtotal = 0; // Exclusive subtotal
    let calculatedGstAmount = 0; // Dynamic GST Amount
    const validatedItems = [];

    for (const item of (orderData.items || [])) {
      const itemId = item.id || item.productId;
      const dbProduct = dbProducts.find(p => p.id === itemId);
      if (!dbProduct) {
         return apiError('VALIDATION_ERROR', { correlationId, overrideMessage: `Product not found: ${itemId}` });
      }
      
      // Check stock
      if ((dbProduct.stock_quantity || 0) < item.quantity) {
         return apiError('VALIDATION_ERROR', { correlationId, overrideMessage: `Insufficient stock for product: ${item.name}` });
      }

      const price = dbProduct.price;
      const itemInclusiveTotal = price * item.quantity;
      calculatedSubtotal += itemInclusiveTotal;

      const gstRateRaw = dbProduct.gst_rate ?? dbProduct.gst_percentage ?? 18;
      const gstRate = typeof gstRateRaw === 'number' ? gstRateRaw : parseFloat(gstRateRaw) || 18;
      const itemBase = itemInclusiveTotal / (1 + (gstRate / 100));
      const itemGst = itemInclusiveTotal - itemBase;

      calculatedExclusiveSubtotal += itemBase;
      calculatedGstAmount += itemGst;
      
      validatedItems.push({
        ...item,
        id: itemId, // Ensure ID is present for stock deduction
        price, // Enforce server price
      });
    }

    const subtotal = calculatedExclusiveSubtotal; // Exclusive subtotal
    const gst_amount = calculatedGstAmount; // Dynamically calculated GST
    
    // Note: Discounts are currently trusted from client if coupon logic is client-side.
    // Ideally this should be validated against a coupon code lookup. 
    // For now, ensuring gst logic is secure.
    const discount_amount = Math.max(0, orderData.discount_amount || 0); 
    const shipping_amount = Math.max(0, orderData.shipping_amount || 0);
    
    // Total is subtotal (inclusive) + shipping - discount
    const total = calculatedSubtotal + shipping_amount - discount_amount;
    
    const normalizeOrderType = (value: unknown): string => {
      if (typeof value !== 'string') return '';
      const key = value.trim().toLowerCase();
      if (['pickup', 'pick-up', 'store pickup', 'store-pickup'].includes(key)) return 'Pickup';
      if (['walk-in', 'walkin', 'walk in'].includes(key)) return 'Walk-in';
      if (['service', 'service order', 'service_call', 'service-call'].includes(key)) return 'Service';
      if (['repair', 'repair order', 'rma'].includes(key)) return 'Repair';
      if (['installation', 'install', 'installation order'].includes(key)) return 'Installation';
      if (['setup', 'set-up', 'custom setup', 'customised setup'].includes(key)) return 'Setup';
      if (['delivery', 'ship', 'shipping'].includes(key)) return 'Delivery';
      return '';
    };

    const rawOrderType = orderData.service_type
      || orderData.type
      || orderData.order_type
      || orderData.category;

    let orderType = normalizeOrderType(rawOrderType);

    // Force service type when flagged explicitly
    if (!orderType && orderData.is_service_order === true) {
      orderType = 'Service';
    }

    if (!orderType) {
      orderType = 'Delivery';
    }

    // Store additional info that doesn't have dedicated columns in the items field
    const pickupStore = orderType === 'Pickup'
      ? (orderData.pickup_store || orderData.delivery_address || null)
      : null;

    const orderItemsWithCustomerInfo = {
      cart_items: orderData.items || [],
      customer_email: orderData.customer_email,
      customer_phone: orderData.customer_phone,
      delivery_address: orderData.delivery_address,
      pickup_store: pickupStore,
      payment_method: orderData.payment_method,
      customer_notes: orderData.notes,
      agent_id: orderData.agent_id || null, // Store agent info if this is an agent order
      otp_required: !!orderData.agent_id // Flag for OTP requirement
    };

    // Only insert fields that exist in the database schema
    // Available fields: id, customer_name, customer_id, status, subtotal, gst_amount, total, type, items, processed_by, created_at
    const orderToInsert = {
      customer_name: orderData.customer_name,
      customer_id: orderData.customer_id || null,
      status: orderData.status || 'Pending',
      subtotal: Math.round(subtotal * 100) / 100,
      gst_amount: Math.round(gst_amount * 100) / 100,
      total: Math.round(total * 100) / 100,
      type: orderType,
      items: orderItemsWithCustomerInfo,
      processed_by: null,
  delivery_address: orderData.delivery_address || pickupStore || null,
      notes: orderData.notes || null,
      payment_method: orderData.payment_method || null,
      customer_email: orderData.customer_email || null,
      customer_phone: orderData.customer_phone || null,
      discount_amount: Math.round(discount_amount * 100) / 100,
      shipping_amount: Math.round(shipping_amount * 100) / 100,
      payment_status: orderData.payment_status || null,
      created_at: new Date().toISOString()
    };

  logger.debug('order_insert_payload', { userId: user.id });

    // Insert order into database
  const { data: createdOrder, error } = await serviceSupabase
      .from('orders')
      .insert([orderToInsert])
      .select()
      .single();

    if (error) {
      logger.error('order_create_db_error', { err: error.message, userId: user.id });
      return apiError('INTERNAL_ERROR', { correlationId, overrideMessage: 'Failed to create order', details: { error: error.message } });
    }

    // Deduct Stock
    for (const item of validatedItems) {
      const { error: stockError } = await serviceSupabase.rpc('decrement_product_stock', {
        p_product_id: item.id,
        p_quantity: item.quantity
      });
      
      if (stockError) {
        logger.error('order_stock_deduction_failed', { orderId: createdOrder.id, productId: item.id, error: stockError.message });
        // Note: In a real production system, you might want to rollback the order here or alert admin
      }
    }

    logger.info('order_created', { orderId: createdOrder.id, userId: user.id });

    // Parse the additional info back for the response
    const orderItemsData = typeof createdOrder.items === 'string'
      ? JSON.parse(createdOrder.items || '{}')
      : (createdOrder.items || {});
    const fullOrder = {
      ...createdOrder,
      customer_email: createdOrder.customer_email || orderItemsData.customer_email,
      customer_phone: createdOrder.customer_phone || orderItemsData.customer_phone,
      delivery_address: createdOrder.delivery_address || orderItemsData.delivery_address,
      payment_method: createdOrder.payment_method || orderItemsData.payment_method,
      notes: createdOrder.notes || orderItemsData.customer_notes,
      items: orderItemsData.cart_items || [],
      pickup_store: orderItemsData.pickup_store || pickupStore || null
    };

    // Handle agent commission if this is an agent order
    if (orderData.agent_id) {
      try {
        // Calculate and save commission
        const commissionResult = await enhancedCommissionService.calculateOrderCommission(
          createdOrder.id,
          orderData.agent_id
        );

        if (commissionResult.success && commissionResult.calculation) {
          const saveResult = await enhancedCommissionService.saveCommissionRecord(
            commissionResult.calculation
          );
          
          if (saveResult.success) {
            logger.info('order_commission_processed', { 
              orderId: createdOrder.id, 
              agentId: orderData.agent_id,
              commissionAmount: commissionResult.calculation.commission_amount
            });
          }
        }

        // Generate OTP for agent verification if customer phone is provided
        if (orderItemsData.customer_phone) {
          const otpResult = await otpService.generateOtp({
            order_id: createdOrder.id,
            agent_id: orderData.agent_id,
            customer_phone: orderItemsData.customer_phone,
            otp_type: 'agent_order'
          });

          if (otpResult.success) {
            logger.info('order_otp_generated', { 
              orderId: createdOrder.id, 
              agentId: orderData.agent_id 
            });
          }
        }
      } catch (agentError) {
        logger.warn('order_agent_processing_failure', { 
          orderId: createdOrder.id, 
          agentId: orderData.agent_id,
          error: agentError instanceof Error ? agentError.message : 'unknown' 
        });
        // Don't fail the order creation if agent processing fails
      }
    }

    // Send order confirmation email - REMOVED per user request (WhatsApp only)
    /*
    try {
  await fetch(`${resolveSiteUrl(request.headers.get('host') || undefined)}/api/email/order-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: orderData.customer_email,
          orderData: fullOrder
        }),
      });
    } catch (emailError) {
      logger.warn('order_email_failure', { orderId: createdOrder.id, error: emailError instanceof Error ? emailError.message : 'unknown' });
      // Don't fail the order creation if email fails
    }
    */

    const adminEmailList = (process.env.ADMIN_ORDER_NOTIFICATION_EMAILS || process.env.ADMIN_NOTIFICATION_EMAILS || '')
      .split(',')
      .map(email => email.trim())
      .filter(Boolean);

    if (adminEmailList.length > 0) {
      try {
        const sent = await emailHelpers.sendAdminOrderNotification(adminEmailList, fullOrder);
        if (!sent) {
          logger.warn('order_admin_email_partial_failure', { orderId: createdOrder.id, adminEmailCount: adminEmailList.length });
        }
      } catch (adminEmailError) {
        logger.warn('order_admin_email_failure', { 
          orderId: createdOrder.id, 
          error: adminEmailError instanceof Error ? adminEmailError.message : 'unknown' 
        });
      }
    }

    // Send WhatsApp notifications
    try {
      const customerPhone = orderItemsData.customer_phone;
      
      if (customerPhone) {
        // Clean and format phone number
        const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

        // Send order confirmation to customer
        await sendOrderConfirmationTemplate(
          formattedPhone,
          createdOrder.id.toString(),
          orderData.customer_name
        );

        logger.info('order_whatsapp_customer_sent', { 
          orderId: createdOrder.id, 
          phone: formattedPhone 
        });

        // Notify admin about new order
        const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
        if (adminPhone) {
          const itemsList = (orderItemsData.cart_items || [])
            .map((item: any) => `• ${item.name} (₹${item.price} x ${item.quantity})`)
            .join('\n');

          const adminMessage = `🛒 New Order Received!\n\n` +
            `📋 Order ID: ${createdOrder.id}\n` +
            `👤 Customer: ${orderData.customer_name}\n` +
            `📱 Phone: ${formattedPhone}\n` +
            `💰 Total: ₹${fullOrder.total}\n` +
            `📦 Items:\n${itemsList || 'No items listed'}\n` +
            `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

          await sendWhatsAppTemplate({
            templateName: 'admin_notification',
            language: 'en',
            recipient: adminPhone,
            components: [
              {
                type: 'text',
                parameters: [
                  { type: 'text', text: adminMessage }
                ]
              }
            ]
          });

          logger.info('order_whatsapp_admin_sent', { 
            orderId: createdOrder.id, 
            adminPhone 
          });
        }

        // Notify manager if different from admin
        const managerPhone = process.env.MANAGER_WHATSAPP_NUMBER;
        if (managerPhone && managerPhone !== adminPhone) {
          const managerMessage = `📋 Order #${createdOrder.id}\n` +
            `👤 ${orderData.customer_name}\n` +
            `💰 ₹${fullOrder.total}\n` +
            `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

          await sendWhatsAppTemplate({
            templateName: 'manager_notification',
            language: 'en',
            recipient: managerPhone,
            components: [
              {
                type: 'text',
                parameters: [
                  { type: 'text', text: managerMessage }
                ]
              }
            ]
          });

          logger.info('order_whatsapp_manager_sent', { 
            orderId: createdOrder.id, 
            managerPhone 
          });
        }
      }
    } catch (whatsappError) {
      logger.warn('order_whatsapp_failure', { 
        orderId: createdOrder.id, 
        error: whatsappError instanceof Error ? whatsappError.message : 'unknown' 
      });
      // Don't fail the order creation if WhatsApp fails
    }

    return apiSuccess({ order: fullOrder }, correlationId);

  } catch (error) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('order_api_uncaught', { error: error instanceof Error ? error.message : 'unknown' });
    return apiError('INTERNAL_ERROR', { correlationId, details: { error: error instanceof Error ? error.message : 'Unknown error' } });
  }
}
