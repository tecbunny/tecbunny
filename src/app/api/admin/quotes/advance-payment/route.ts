import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sendWhatsAppNotification } from '@/lib/whatsapp-service';

let supabaseInstance: any = null;
function getSupabase(): any {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

interface AdvancePaymentPayload {
  quote_id: string;
  advance_amount: number;
  total_amount: number;
  payment_method: 'payu' | 'wire_transfer';
  payment_terms?: string;
}

export async function POST(req: Request) {
  try {
    // Check authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin role - extract from JWT or validate against auth
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if user is admin/superadmin/manager
    const { data: userData } = await getSupabase()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = userData?.role || user.user_metadata?.role;
    if (!['admin', 'superadmin', 'manager'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const payload: AdvancePaymentPayload = await req.json();
    const { quote_id, advance_amount, total_amount, payment_method, payment_terms } = payload;

    if (!quote_id || !advance_amount || !total_amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch the quote
    const { data: quote, error: quoteError } = await getSupabase()
      .from('quotes')
      .select('*')
      .eq('id', quote_id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      );
    }

    // Check if advance payment request already exists
    const { data: existingRequest } = await getSupabase()
      .from('advance_payment_requests')
      .select('id, status')
      .eq('quote_id', quote_id)
      .neq('status', 'completed')
      .single();

    if (existingRequest && ['pending', 'confirmed', 'payment_initiated', 'paid'].includes(existingRequest.status)) {
      return NextResponse.json(
        { success: false, error: 'Active advance payment request already exists' },
        { status: 409 }
      );
    }

    // Create advance payment request
    const { data: advancePayment, error: insertError } = await getSupabase()
      .from('advance_payment_requests')
      .insert({
        quote_id,
        admin_id: user.id,
        advance_amount,
        total_amount,
        payment_method: payment_method || 'payu',
        payment_terms: payment_terms || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Failed to create advance payment request:', { error: insertError.message, details: insertError.details });
      return NextResponse.json(
        { success: false, error: 'Failed to create advance payment request' },
        { status: 500 }
      );
    }

    // Update quote with advance_payment_id
    await getSupabase()
      .from('quotes')
      .update({ advance_payment_id: advancePayment.id })
      .eq('id', quote_id);

    // Send notification to customer
    try {
      const customerPhone = quote.customer_phone || quote.customer_email;
      if (customerPhone) {
        const formattedPhone = customerPhone.replace(/[^\d]/g, '');
        const phoneWithCode = formattedPhone.startsWith('91') ? formattedPhone : `91${formattedPhone}`;
        
        await sendWhatsAppNotification(
          phoneWithCode, 
          `🚨 *ADVANCE PAYMENT REQUEST*\n\nCustomer: ${quote.customer_name}\nAdvance Amount: ₹${advance_amount.toLocaleString('en-IN')}\nTotal Quote: ₹${total_amount.toLocaleString('en-IN')}\nPayment Method: ${payment_method === 'payu' ? 'Online (PayU)' : 'Wire Transfer'}\n\nPlease confirm and proceed with payment: ${process.env.NEXT_PUBLIC_APP_URL}/quotes/${quote_id}/advance-payment`
        );
      }
    } catch (whatsappError: any) {
      logger.warn('Failed to send WhatsApp notification:', whatsappError.message);
    }

    logger.info('Advance payment request created', {
      quote_id,
      advance_payment_id: advancePayment.id,
      advance_amount,
      admin_id: user.id,
    });

    return NextResponse.json({
      success: true,
      data: advancePayment,
      message: 'Advance payment request created and customer notified',
    });

  } catch (error: any) {
    logger.error('Error creating advance payment request:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const quoteId = searchParams.get('quote_id');

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: 'quote_id parameter required' },
        { status: 400 }
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quoteId);
    let realQuoteId = quoteId;
    if (!isUuid) {
      const { data: q } = await getSupabase().from('quotes').select('id').eq('quote_number', quoteId).single();
      if (q) realQuoteId = q.id;
    }

    const { data: advancePayment, error } = await getSupabase()
      .from('advance_payment_requests')
      .select('*')
      .eq('quote_id', realQuoteId)
      .order('created_at', { ascending: false })
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: advancePayment || null,
    });

  } catch (error: any) {
    logger.error('Error fetching advance payment request:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
