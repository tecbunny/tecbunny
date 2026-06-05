import { NextRequest, NextResponse } from 'next/server';
import { checkoutEngine } from '@/lib/checkout-engine';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    // Check superadmin session cookie first to block checkout calculations
    const superadminCookie = req.cookies.get('superadmin-session')?.value;
    if (superadminCookie) {
      const correctEmail = process.env.SUPERADMIN_USER_ID || process.env.SUPERADMIN_EMAIL;
      const correctPassword = process.env.SUPERADMIN_PASSWORD;
      if (correctEmail && correctPassword) {
        const secret = process.env.SUPERADMIN_PASSWORD || 'superadmin_salt_key_default';
        const msgBuffer = new TextEncoder().encode(`${correctEmail}:${correctPassword}:${secret}`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const expectedToken = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (superadminCookie === expectedToken) {
          return NextResponse.json(
            { error: '403 Forbidden - System Configuration Accounts Cannot Place Orders.' },
            { status: 403 }
          );
        }
      }
    }

    const body = await req.json();
    const { items, customerCategory, couponCode, salesAgentId } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items payload' }, { status: 400 });
    }

    // Get user id from session if available
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    const result = await checkoutEngine.calculate({
      items,
      userId,
      customerCategory,
      couponCode,
      salesAgentId
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in /api/checkout/calculate', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
