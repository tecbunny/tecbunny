import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let realId = id;
    if (!isUuid) {
      const { data: q } = await supabase.from('quotes').select('id').eq('quote_number', id).single();
      if (q) realId = q.id;
    }

    // Update quote status to 'rejected' (customer rejected counter-offer)
    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'declined' })
      .eq('id', realId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, quote: data });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error?.message || 'Failed to decline counter-offer' },
      { status: 400 }
    );
  }
}
