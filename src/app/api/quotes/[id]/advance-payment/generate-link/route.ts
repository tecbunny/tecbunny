import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

interface PaymentLinkPayload {
  advance_payment_id: string;
}

function generatePayUHash(params: Record<string, string | number>): string {
  const key = process.env.PAYU_MERCHANT_KEY || '';
  const salt = process.env.PAYU_MERCHANT_SALT || '';
  
  // Create hash string in specific order for PayU
  const hashString = `${key}|${params.txnid}|${params.amount}|${params.productinfo}|${params.firstname}|${params.email}|||||||||||${salt}`;
  
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

export async function POST(req: Request) {
  try {
    const payload: PaymentLinkPayload = await req.json();
    const { advance_payment_id } = payload;

    if (!advance_payment_id) {
      return NextResponse.json(
        { success: false, error: 'advance_payment_id required' },
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

    if (advancePayment.status !== 'confirmed') {
      return NextResponse.json(
        { success: false, error: `Cannot initiate payment with status: ${advancePayment.status}` },
        { status: 409 }
      );
    }

    // Fetch quote for customer details
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, customer_name, customer_email, customer_phone')
      .eq('id', advancePayment.quote_id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      );
    }

    // Generate PayU transaction ID (unique per payment)
    const txnId = `TXN-${advancePayment.id.substring(0, 8)}-${Date.now()}`;

    // Prepare PayU payment parameters
    const paymentParams = {
      key: process.env.PAYU_MERCHANT_KEY || '',
      txnid: txnId,
      amount: Math.round(advancePayment.advance_amount),
      productinfo: `Advance Payment for CCTV Quote ${advancePayment.quote_id.substring(0, 8)}`,
      firstname: quote.customer_name,
      email: quote.customer_email,
      phone: quote.customer_phone?.replace(/[^\d]/g, '') || '',
      surl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payment/payu/success`,
      furl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payment/payu/failure`,
      curl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payment/payu/cancel`,
      udf1: advancePayment.id,
      udf2: advancePayment.quote_id,
      udf3: 'advance_payment',
    };

    // Generate hash
    const hash = generatePayUHash(paymentParams);

    // Update advance payment with transaction ID
    await supabase
      .from('advance_payment_requests')
      .update({
        status: 'payment_initiated',
        transaction_id: txnId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', advance_payment_id);

    // Return payment form data (client will submit this to PayU)
    const payUEnvironment = process.env.PAYU_ENVIRONMENT || 'production';
    const payUUrl = payUEnvironment === 'production'
      ? 'https://secure.payu.in/_payment'
      : 'https://test.payu.in/_payment';

    return NextResponse.json({
      success: true,
      data: {
        paymentUrl: payUUrl,
        paymentParams: {
          ...paymentParams,
          hash,
        },
        advancePaymentId: advance_payment_id,
        transactionId: txnId,
      },
      message: 'Payment link generated successfully',
    });

  } catch (error: any) {
    logger.error('Error generating PayU payment link:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
