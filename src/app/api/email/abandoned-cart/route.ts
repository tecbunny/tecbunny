import { NextRequest, NextResponse } from 'next/server';

import { sendWhatsAppNotification } from '../../../../lib/whatsapp-service';
import { logger } from '../../../../lib/logger';
import { rateLimit } from '../../../../lib/rate-limit';
import { createClient as createServerClient } from '../../../../lib/supabase/server';

// Abandoned cart reminders: 3 per 12h per user/IP
const LIMIT = 3;
const WINDOW_MS = 12 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, phone, userName, cartItems, restoreCartUrl, discountCode, minutesSinceAbandoned } = body || {};
    
    // Prioritize phone for WhatsApp
    const targetPhone = phone || (to && /^\d+$/.test(to.replace(/[^\d]/g, '')) ? to : null);

    if (!targetPhone) {
      // If no phone, we cannot send WhatsApp (user requested NO email)
      logger.warn('Abandoned cart: No phone provided, skipping notification per WhatsApp-only policy');
      // Return success to prevent retry
      return NextResponse.json({ success: true, message: 'Skipped - No phone number' }); 
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: 'cartItems must be a non-empty array' }, { status: 400 });
    }

    let userId: string | null = null;
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch(_) {}

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = userId ? `user:${userId}` : `ip:${ip}`;

    if (!rateLimit(rateKey, 'whatsapp_abandoned_cart', { limit: LIMIT, windowMs: WINDOW_MS })) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await sendAbandonedCartWhatsApp(targetPhone, {
      userName,
      cartItems,
      restoreCartUrl,
      discountCode,
      minutesSinceAbandoned
    });

    const res = NextResponse.json({ success: true, message: 'Abandoned cart WhatsApp sent' });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'same-origin');
    return res;

  } catch (error: any) {
    logger.error('Abandoned cart API error:', { error: error.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendAbandonedCartWhatsApp(phoneNumber: string, data: any) {
  try {
    const itemCount = data.cartItems.length;
    const itemNames = data.cartItems.slice(0, 3).map((i: any) => `• ${i.name}`).join('\n');
    const moreItems = itemCount > 3 ? `\n...and ${itemCount - 3} more items` : '';

    const message = `
🛒 Forgotten Items? - TecBunny Store

${data.userName ? `Hi ${data.userName}! ` : ''}We noticed you left some items in your cart. They're selling out fast! 🏃‍♂️

Items waiting for you:
${itemNames}${moreItems}

${data.discountCode ? `🎁 Use code *${data.discountCode}* for a special discount!` : ''}

Click here to complete your order:
${data.restoreCartUrl}

Need help? Reply to this message.
    `.trim();

    await sendWhatsAppNotification(phoneNumber, message);
    logger.info('Abandoned cart WhatsApp sent:', { phoneNumber });
  } catch (error: any) {
    logger.error('Failed to send abandoned cart WhatsApp:', { error: error.message });
  }
}
