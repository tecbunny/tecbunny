import { NextRequest, NextResponse } from 'next/server';

import { sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { orderId, orderTotal, orderType, customerName } = await request.json();
    
    // Send to TEAM numbers defined in ENV
    const teamNumbers = [
      process.env.TEAM_WHATSAPP_1,
      process.env.TEAM_WHATSAPP_2
    ].filter(Boolean) as string[];

    if (teamNumbers.length === 0) {
       return NextResponse.json({ success: true, message: 'No team numbers configured' });
    }

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = `order-approved:${ip}`;
    if (!rateLimit(rateKey, 'whatsapp_order_approved', { limit: LIMIT, windowMs: WINDOW_MS })) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const message = `
✅ Order Approved - Admin Notification

🆔 Order: ${orderId}
👤 Customer: ${customerName || 'N/A'}
💰 Total: ${orderTotal}
🚚 Type: ${orderType || 'Standard'}

The order has been approved and is ready for processing.
    `.trim();

    for (const number of teamNumbers) {
       await sendWhatsAppNotification(number, message);
    }

    return NextResponse.json({ success: true, message: 'Approval WhatsApp sent' });
  } catch (error: any) {
    logger.error('Order approval WhatsApp API error:', { error: error.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
