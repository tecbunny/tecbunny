import { NextRequest, NextResponse } from 'next/server';
import { checkoutEngine } from '@/lib/checkout-engine';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { CustomerCategory } from '@/lib/types';
import { verifySuperadminSessionToken } from '@/lib/auth/superadmin-session';

export async function POST(req: NextRequest) {
  try {
    // Check superadmin session cookie first to block checkout calculations
    const superadminCookie = req.cookies.get('superadmin-session')?.value;
    if (await verifySuperadminSessionToken(superadminCookie)) {
      return NextResponse.json(
        { error: '403 Forbidden - System Configuration Accounts Cannot Place Orders.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { items, customerCategory, couponCode, salesAgentId } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items payload' }, { status: 400 });
    }

    // Defensive type casting for items to prevent variable type coercion failures in the checkout engine
    const validatedItems = items.map(item => ({
      ...item,
      id: String(item.id || item.productId || ''),
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      mrp: item.mrp != null ? Number(item.mrp) : null
    }));

    // Get user id from session if available
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    const result = await checkoutEngine.calculate({
      items: validatedItems,
      userId,
      customerCategory: customerCategory ? String(customerCategory) as CustomerCategory : undefined,
      couponCode: couponCode ? String(couponCode) : undefined,
      salesAgentId: salesAgentId ? String(salesAgentId) : undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in /api/checkout/calculate', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
