import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = typeof body?.productId === 'string' ? body.productId : null;
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Login required.' }, { status: 401 });
    }

    if (!isSupabaseServiceConfigured) {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 500 });
    }

    const service = createServiceClient();
    const { error } = await service
      .from('leads')
      .insert({
        user_id: user.id,
        type: 'price_request_ai',
        status: 'new',
        product_id: productId,
        customer_email: user.email,
        customer_phone: phone || null,
        notes: JSON.stringify({
          query,
          notes,
          source: 'ai-research',
          createdAt: new Date().toISOString(),
        }),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to submit price request.' },
      { status: 500 }
    );
  }
}
