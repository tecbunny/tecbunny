import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

interface ConfirmAdvancePaymentPayload {
  advance_payment_id: string;
  final_quotation_url?: string;
  customer_notes?: string;
  agree_to_terms: boolean;
}

export async function POST(req: Request) {
  try {
    const payload: ConfirmAdvancePaymentPayload = await req.json();
    const { advance_payment_id, final_quotation_url, customer_notes, agree_to_terms } = payload;

    if (!advance_payment_id || !agree_to_terms) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch advance payment request
    const { data: advancePayment, error: fetchError } = await supabase
      .from('advance_payment_requests')
      .select('*')
      .eq('id', advance_payment_id)
      .single();

    if (fetchError || !advancePayment) {
      return NextResponse.json(
        { success: false, error: 'Advance payment request not found' },
        { status: 404 }
      );
    }

    if (advancePayment.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot confirm advance payment with status: ${advancePayment.status}` },
        { status: 409 }
      );
    }

    // Update advance payment request status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('advance_payment_requests')
      .update({
        status: 'confirmed',
        final_quotation_url: final_quotation_url || null,
        customer_notes: customer_notes || null,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', advance_payment_id)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to confirm advance payment:', { updateError });
      return NextResponse.json(
        { success: false, error: 'Failed to confirm advance payment' },
        { status: 500 }
      );
    }

    // Fetch quote to get customer info
    const { data: quote } = await supabase
      .from('quotes')
      .select('customer_name, customer_email, customer_phone')
      .eq('id', advancePayment.quote_id)
      .single();

    logger.info('Advance payment confirmed by customer', {
      advance_payment_id,
      quote_id: advancePayment.quote_id,
      customer_notes: !!customer_notes,
      has_quotation: !!final_quotation_url,
    });

    return NextResponse.json({
      success: true,
      data: updatedPayment,
      message: 'Advance payment confirmed. Proceeding to payment...',
    });

  } catch (error: any) {
    logger.error('Error confirming advance payment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: advancePayment, error } = await supabase
      .from('advance_payment_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !advancePayment) {
      return NextResponse.json(
        { success: false, error: 'Advance payment request not found' },
        { status: 404 }
      );
    }

    // Fetch associated quote
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, customer_name, customer_email, counter_price, negotiation_clauses')
      .eq('id', advancePayment.quote_id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        ...advancePayment,
        quote,
      },
    });

  } catch (error: any) {
    logger.error('Error fetching advance payment request:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
