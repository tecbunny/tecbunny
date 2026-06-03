import { NextRequest, NextResponse } from 'next/server';

import { sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { createClient as createServerClient } from '@/lib/supabase/server';

const LIMIT = 5; // per 10 min
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { phone,  orderData, pickupCode } = await request.json();
    
    if (!phone) {
       // If no phone, skip
       return NextResponse.json({ success: true, message: 'Skipped - No phone' });
    }

    if (!orderData || typeof orderData !== 'object' || !pickupCode || typeof pickupCode !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let userId: string | null = null;
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch(_ignoreErr) {}

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = userId ? `user:${userId}` : `ip:${ip}`;
    if (!rateLimit(rateKey, 'whatsapp_pickup', { limit: LIMIT, windowMs: WINDOW_MS })) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await sendPickupWhatsApp(phone, orderData, pickupCode);

    const res = NextResponse.json({ success: true, message: 'Pickup notification WhatsApp sent successfully' });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'same-origin');
    return res;
  } catch (error) {
    logger.error('Pickup notification WhatsApp API error:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendPickupWhatsApp(phone: string, orderData: any, pickupCode: string) {
    try {
        const message = `
🛍️ Order Ready for Pickup! - TecBunny Store

${orderData.customer_name ? `Hi ${orderData.customer_name}! ` : ''}Your order is ready to be picked up! 🎉

📦 Order: ${formatOrderNumber(orderData.id)}
🔢 Pickup Code: *${pickupCode}*

📍 Pickup Location:
${orderData.pickup_store || orderData.delivery_address || 'Store Location'}

Please show this message when you arrive.
Store Hours: 10:00 AM - 8:00 PM

Questions? Reply to this message.
See you soon! 👋
        `.trim();
        await sendWhatsAppNotification(phone, message);
    } catch (e: any) {
        logger.error('Failed to send pickup WhatsApp', {error: e.message});
    }
}

function formatOrderNumber(id: string) {
    if (!id) return '';
    return id.slice(-6).toUpperCase();
}
