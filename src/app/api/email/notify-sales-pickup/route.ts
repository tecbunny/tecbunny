import { NextRequest, NextResponse } from 'next/server';

import { sendWhatsAppNotification } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

const LIMIT = 10; // higher allowance for internal notifications
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    
    const teamNumbers = [
      process.env.TEAM_WHATSAPP_1,
      process.env.TEAM_WHATSAPP_2
    ].filter(Boolean) as string[];

    if (teamNumbers.length === 0) {
       return NextResponse.json({ success: true, message: 'No team numbers configured' });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = `notify-sales:${ip}`;

    if (!rateLimit(rateKey, 'whatsapp_sales_pickup', { limit: LIMIT, windowMs: WINDOW_MS })) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const message = `
🏬 Pickup Order Alert!

📦 Order: ${orderId}
⚠️ Action Required: Customer is arriving for pickup / Pick up initiated.
Check dashboard for details.
    `.trim();

    for (const number of teamNumbers) {
      await sendWhatsAppNotification(number, message);
    }

    return NextResponse.json({ success: true, message: 'Sales pickup WhatsApp sent' });
  } catch (error: any) {
    logger.error('Sales pickup notification WhatsApp API error:', { error: error.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
