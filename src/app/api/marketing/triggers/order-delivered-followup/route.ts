import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { WhatsAppService } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';

/**
 * Triggered after order delivery to send localized upsell offers
 * Based on inventory metadata (surveillance/hardware)
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const whatsapp = new WhatsAppService();

    // 1. Fetch order with items and customer details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_name,
        customer_phone,
        total,
        items,
        customer_id
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      logger.error('upsell_trigger_order_fetch_failed', { orderId, error: orderError });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Evaluate inventory for upsell potential (Surveillance/Hardware)
    const items = order.items as any[];
    const hasHardware = items.some(item => 
      item.name.toLowerCase().includes('camera') || 
      item.name.toLowerCase().includes('dvr') || 
      item.name.toLowerCase().includes('nvr') ||
      item.name.toLowerCase().includes('cctv')
    );

    if (!hasHardware) {
      return NextResponse.json({ success: true, message: 'No upsell conditions met' });
    }

    // 3. Generate dynamic coupon (Storage/Power enhancement)
    const couponCode = `UPGRADE-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 48);

    const { error: couponError } = await supabase
      .from('coupons')
      .insert({
        code: couponCode,
        type: 'percentage',
        value: 15,
        status: 'active',
        expiry_date: expiryDate.toISOString(),
        description: 'Post-delivery surveillance accessory upgrade',
        per_user_limit: 1,
        usage_limit: 1
      });

    if (couponError) {
      logger.error('upsell_trigger_coupon_generation_failed', { orderId, error: couponError });
    }

    // 4. Dispatch Infobip WhatsApp Payload
    if (order.customer_phone) {
      const payload = {
        templateName: 'surveillance_upsell_1',
        templateData: {
          body: {
            placeholders: [order.customer_name || 'Valued Customer', '15%', couponCode]
          },
          buttons: [
            {
              type: 'URL',
              parameter: `checkout?coupon=${couponCode}&source=upsell`
            }
          ]
        },
        language: 'en_US'
      };

      await whatsapp.sendMessage(order.customer_phone, payload, 'template', true, 'orderUpdates');
      
      logger.info('upsell_whatsapp_dispatched', { orderId, couponCode });
    }

    return NextResponse.json({ 
      success: true, 
      triggered: true, 
      coupon: couponCode 
    });

  } catch (error: any) {
    logger.error('upsell_trigger_error', { error: error.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
