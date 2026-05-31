import { NextRequest, NextResponse } from 'next/server';
import { checkoutEngine } from '@/lib/checkout-engine';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
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
