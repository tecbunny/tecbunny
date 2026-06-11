import { NextRequest } from 'next/server';

import { createClient as createServerClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { resolveSiteUrl } from '@/lib/site-url';
import { GST_RATE } from '@/lib/constants';
import { apiError, apiSuccess } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { 
  sendOrderNotification,
  sendWhatsAppNotification
} from '@/lib/whatsapp-service';
import { otpService } from '@/lib/otp-service';
import { enhancedCommissionService } from '@/lib/enhanced-commission-service';
import { emailHelpers } from '@/lib/email';
import { checkoutEngine } from '@/lib/checkout-engine';
import { formatPlaceOfSupply, resolveIndianStateFromText, resolveIndianStateInfo, TECBUNNY_REGISTERED_STATE } from '@/lib/indian-tax';
import { verifySuperadminSessionToken } from '@/lib/auth/superadmin-session';

const RATE_LIMIT = 5; // 5 orders
const RATE_WINDOW_MS = 60 * 1000; // per minute

export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;

    // Check superadmin session cookie first to block order placements
    const superadminCookie = request.cookies.get('superadmin-session')?.value;
    if (await verifySuperadminSessionToken(superadminCookie)) {
      return apiError('FORBIDDEN', {
        correlationId,
        overrideMessage: '403 Forbidden - System Configuration Accounts Cannot Place Orders.'
      });
    }

    // Support both cookie-based auth (SSR) and Authorization: Bearer token (client fetch)
    // The Bearer token path is more reliable for client-side fetches where cookie
    // forwarding may be inconsistent (e.g. cross-subdomain, expired cookie, first login).
    let user = null;

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = await createServerClient();
    
    if (bearerToken) {
      const { data: { user: tokenUser } } = await supabase.auth.getUser(bearerToken);
      user = tokenUser;
    } else {
      const { data: { user: cookieUser } } = await supabase.auth.getUser();
      user = cookieUser;
    }

    const serviceSupabase = isSupabaseServiceConfigured ? createServiceClient() : await createServerClient();

    const effectiveUserId = user?.id ?? null;

    // Allow guest checkout; rate-limit by authenticated user or a guest key.
    const rateLimitKey = effectiveUserId || `guest:${request.headers.get('x-forwarded-for') || 'unknown'}:${request.headers.get('x-real-ip') || 'unknown'}`;
    const limitCheck = await rateLimit(rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limitCheck.allowed) {
      logger.warn('orders_rate_limited', { userId: effectiveUserId, rateLimitKey });
      return apiError('RATE_LIMITED', { correlationId });
    }

    const orderData = await request.json();

logger.info('order_create_attempt', { userId: effectiveUserId });

    // Validate required fields
    if (!orderData.customer_name || !orderData.customer_email || !orderData.customer_phone) {
      return apiError('VALIDATION_ERROR', { correlationId, overrideMessage: 'Missing required customer information' });
    }

    // Security: Recalculate totals server-side to prevent price tampering
    // We now rely solely on the CheckoutEngine for the final source of truth for taxes and totals
    const checkoutResult = await checkoutEngine.calculate({
      items: (orderData.items || []).map((item: any) => ({
        id: item.id || item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      userId: effectiveUserId || undefined,
      couponCode: orderData.coupon_code || orderData.couponCode || undefined,
      salesAgentId: orderData.agent_id || undefined,
    });

    const serverDiscountPaise = Math.round(checkoutResult.totalDiscount * 100);
    const clientDiscountPaise = Math.round(Math.max(0, orderData.discount_amount || 0) * 100);

    if (clientDiscountPaise > serverDiscountPaise + 100) { // 100 Paise (1 INR) tolerance
      logger.warn('order_discount_tampered', {
        userId: effectiveUserId,
        clientDiscount: clientDiscountPaise / 100,
        serverDiscount: serverDiscountPaise / 100
      });
      return apiError('VALIDATION_ERROR', { correlationId, overrideMessage: 'Invalid discount amount' });
    }

    const subtotal = checkoutResult.subtotal;
    const gst_amount = checkoutResult.gstAmount;
    const discount_amount = checkoutResult.totalDiscount;
    const shipping_amount = 0; // Fix: calculate shipping rules definitively here instead of trusting client
    const total = checkoutResult.finalTotal + shipping_amount;

    // Re-map validated items from checkout engine for the RPC
    const validatedItems = checkoutResult.itemPrices.map(item => ({
      id: item.product_id,
      productId: item.product_id,
      quantity: item.quantity,
      price: item.unit_price,
      total_price: item.total_price,
      discount_amount: item.discount_amount
    }));
    
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
    const destinationState = resolveIndianStateInfo(orderData.place_of_supply_state_code)
      ?? resolveIndianStateInfo(orderData.customer_state_code)
      ?? resolveIndianStateInfo(orderData.customer_state)
      ?? resolveIndianStateFromText(orderData.delivery_address)
      ?? (orderType === 'Pickup' ? TECBUNNY_REGISTERED_STATE : null);
    const placeOfSupply = formatPlaceOfSupply(
      destinationState,
      typeof orderData.place_of_supply === 'string' ? orderData.place_of_supply : orderData.customer_state,
    );

    // Full JSONB payload stored in the orders.items column by the RPC so the entire
    // customer context (phone, email, address) is recoverable from the row alone.
    const orderItemsWithCustomerInfo = {
      cart_items: validatedItems,
      customer_email: orderData.customer_email,
      customer_phone: orderData.customer_phone,
      delivery_address: orderData.delivery_address,
      pickup_store: pickupStore,
      customer_state: destinationState?.name || orderData.customer_state || null,
      customer_state_code: destinationState?.code || orderData.customer_state_code || null,
      place_of_supply: placeOfSupply,
      place_of_supply_state_code: destinationState?.code || orderData.place_of_supply_state_code || null,
      seller_state_code: TECBUNNY_REGISTERED_STATE.code,
      payment_method: orderData.payment_method,
      customer_notes: orderData.notes,
      agent_id: orderData.agent_id || null, // Store agent info if this is an agent order
      otp_required: !!orderData.agent_id, // Flag for OTP requirement
      part_payment_amount: orderData.part_payment_amount ? Number(orderData.part_payment_amount) : null,
      quote_id: orderData.quote_id || null
    };

    // Execute atomic allocation and order placement via PostgreSQL RPC
    const { data: rpcResult, error: rpcError } = await serviceSupabase.rpc('allocate_order_inventory_atomic', {
      p_customer_name: orderData.customer_name,
      p_customer_id: effectiveUserId,
      p_customer_email: orderData.customer_email,
      p_customer_phone: orderData.customer_phone,
      p_delivery_address: orderData.delivery_address || pickupStore || null,
      p_notes: orderData.notes || null,
      p_payment_method: orderData.payment_method || null,
      p_subtotal: Math.round(subtotal * 100) / 100,
      p_gst_amount: Math.round(gst_amount * 100) / 100,
      p_total: Math.round(total * 100) / 100,
      p_discount_amount: Math.round(discount_amount * 100) / 100,
      p_shipping_amount: Math.round(shipping_amount * 100) / 100,
      p_payment_status: orderData.payment_status || null,
      p_order_type: orderType,
      // Pass full customer-context JSONB so the RPC stores it in the items column
      p_items: orderItemsWithCustomerInfo,
      p_agent_id: orderData.agent_id || null
    });

    if (rpcError) {
      logger.error('order_create_rpc_error', { err: rpcError.message, userId: effectiveUserId });
      return apiError('VALIDATION_ERROR', { correlationId, overrideMessage: rpcError.message || 'Failed to allocate stock and create order.' });
    }

    if (!rpcResult || !rpcResult.success || !rpcResult.order) {
      logger.error('order_create_rpc_invalid_response', { rpcResult, userId: effectiveUserId });
      return apiError('INTERNAL_ERROR', { correlationId, overrideMessage: 'Invalid response from allocation engine.' });
    }

    const createdOrder = rpcResult.order;

    logger.info('order_created', { orderId: createdOrder.id, userId: effectiveUserId });

    // Parse the additional info back for the response
    const orderItemsData = typeof createdOrder.items === 'string'
      ? JSON.parse(createdOrder.items || '{}')
      : (createdOrder.items || {});
    const fullOrder = {
      ...createdOrder,
      customer_email: createdOrder.customer_email || orderItemsData.customer_email,
      customer_phone: createdOrder.customer_phone || orderItemsData.customer_phone,
      delivery_address: createdOrder.delivery_address || orderItemsData.delivery_address,
      customer_state: orderItemsData.customer_state,
      customer_state_code: orderItemsData.customer_state_code,
      place_of_supply: orderItemsData.place_of_supply,
      place_of_supply_state_code: orderItemsData.place_of_supply_state_code,
      seller_state_code: orderItemsData.seller_state_code,
      payment_method: createdOrder.payment_method || orderItemsData.payment_method,
      notes: createdOrder.notes || orderItemsData.customer_notes,
      items: orderItemsData.cart_items || [],
      pickup_store: orderItemsData.pickup_store || pickupStore || null
    };

    // Verify agent_id context against user session
    let isAgentThemselves = false;
    if (orderData.agent_id) {
      const { data: agentRecord } = await serviceSupabase
        .from('sales_agents')
        .select('user_id')
        .eq('id', orderData.agent_id)
        .maybeSingle();
      if (agentRecord && agentRecord.user_id === effectiveUserId) {
        isAgentThemselves = true;
      }
    }

    // Handle agent commission if this is an agent order
    if (orderData.agent_id) {
      try {
        if (isAgentThemselves) {
          // Calculate and save commission immediately
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
        } else {
          logger.info('order_commission_deferred', {
            orderId: createdOrder.id,
            agentId: orderData.agent_id,
            reason: 'Placed by user other than the agent (deferred until OTP verification)'
          });
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
        await sendOrderNotification(formattedPhone, {
          orderNumber: createdOrder.id.toString(),
          customerName: orderData.customer_name
        });

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

          const siteUrl = resolveSiteUrl(request.headers.get('host') || undefined);
          const adminMessage = `🛒 New Order Received!\n\n` +
            `📋 Order ID: ${createdOrder.id}\n` +
            `👤 Customer: ${orderData.customer_name}\n` +
            `📱 Phone: ${formattedPhone}\n` +
            `💰 Total: ₹${fullOrder.total}\n` +
            `📦 Items:\n${itemsList || 'No items listed'}\n` +
            `🔗 View: ${siteUrl}/mgmt/admin/orders/${createdOrder.id}\n` +
            `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

          await sendWhatsAppNotification(adminPhone, adminMessage);

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

          await sendWhatsAppNotification(managerPhone, managerMessage);

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
