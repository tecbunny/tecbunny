import { NextRequest, NextResponse } from 'next/server';

import { sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { createClient as createServerClient } from '@/lib/supabase/server';

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
    } catch(_ignoreErr) {}

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
    const minutesSince = data.minutesSinceAbandoned || 60;

    let subject = '';
    let body = '';
    let discountCode = data.discountCode;

    if (minutesSince <= 120) {
      // Step 1: 1-2 hours - Soft Nudge
      subject = "🛒 Did you forget something?";
      body = `Hi ${data.userName || 'there'}! We noticed you left some premium tech in your cart. They're still waiting for you, but we can't hold them forever! 🏃‍♂️`;
    } else if (minutesSince <= 480) {
      // Step 2: 6-8 hours - Urgency + 5% Off
      subject = "⚡ Your cart is expiring!";
      discountCode = discountCode || 'SAVE5';
      body = `Hi ${data.userName || 'there'}! Your cart is about to expire. Complete your purchase in the next 2 hours and use code *${discountCode}* for an extra 5% OFF! 🎁`;
    } else {
      // Step 3: 24 hours - High Urgency + 10% Off
      subject = "🔥 LAST CHANCE: Items selling out!";
      discountCode = discountCode || 'BUNNY10';
      body = `This is your final reminder! Items in your cart are in high demand and may sell out soon. We've upgraded your discount to 10% with code *${discountCode}*. Don't miss out! 🐰`;
    }

    const message = `
${subject} - TecBunny Store

${body}

Items waiting for you:
${itemNames}${moreItems}

Click here to secure your order:
${data.restoreCartUrl}

Need help? Reply to this message.
    `.trim();

    await sendWhatsAppNotification(phoneNumber, message);
    logger.info('Abandoned cart WhatsApp sent:', { phoneNumber, step: minutesSince <= 120 ? 1 : minutesSince <= 480 ? 2 : 3 });
  } catch (error: any) {
    logger.error('Failed to send abandoned cart WhatsApp:', { error: error.message });
  }
}
