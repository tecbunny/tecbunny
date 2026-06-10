import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { sendWhatsAppNotification } from '@/lib/whatsapp-service';

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const serviceClient = createServiceClient();
    
    const body = await req.json();
    const { quoteId, name, email, phone, address, biddedPrice, summary, customSetupConfig } = body;

    // Validate: bid price must be at least 70% of quoted price
    // Calculate original price from customSetupConfig
    let originalPrice = 0;
    if (customSetupConfig?.totals?.overall?.sale) {
      originalPrice = customSetupConfig.totals.overall.sale;
    } else if (customSetupConfig?.totals?.sale) {
      originalPrice = customSetupConfig.totals.sale;
    }

    const minBidPrice = originalPrice * 0.7; // 70% minimum

    if (originalPrice > 0 && biddedPrice < minBidPrice) {
      return NextResponse.json({ 
        error: `Bid price must be at least ₹${Math.round(minBidPrice).toLocaleString()} (70% of quoted price)` 
      }, { status: 400 });
    }

    let finalQuoteId = quoteId;
    let finalQuoteNumber = '';

    // If no quoteId exists yet, create one
    if (!finalQuoteId) {
      const formattedSelections = {
        type: 'customised_setup',
        ...customSetupConfig,
        totals: customSetupConfig?.totals?.overall || customSetupConfig?.totals || {}
      };

      const quoteNumber = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(10000 + Math.random() * 90000))}`;

      const { data, error } = await serviceClient.from('quotes').insert({
        user_id: session?.user?.id || null,
        customer_name: name,
        customer_email: email || 'anonymous@tecbunny.com',
        customer_phone: phone,
        customer_address: address,
        bidded_price: biddedPrice,
        summary: summary,
        selections: formattedSelections,
        status: 'bidded',
        quote_number: quoteNumber,
        expiry_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }).select('id, quote_number').single();

      if (error) throw error;
      finalQuoteId = data.id;
      finalQuoteNumber = data.quote_number;
    } else {
      const { error } = await serviceClient.from('quotes').update({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        customer_address: address,
        bidded_price: biddedPrice,
        status: 'bidded'
      }).eq('id', finalQuoteId);
      if (error) throw error;

      // Fetch quote number for redirect
      const { data: q } = await serviceClient.from('quotes').select('quote_number').eq('id', finalQuoteId).single();
      finalQuoteNumber = q?.quote_number || '';
    }

    // Notify Admins
    try {
      await sendWhatsAppNotification(
        process.env.ADMIN_WHATSAPP_NUMBER || '+919604136010', 
        `🚨 *NEW QUOTE BID RECEIVED*\n\nCustomer: ${name}\nBid Price: ₹${biddedPrice}\n\nReview immediately in the Admin Desk: https://tecbunny.com/mgmt/admin/quotes`
      );
    } catch (e) {
      // Ignore whatsapp failure
    }

    return NextResponse.json({ success: true, quoteId: finalQuoteId, quoteNumber: finalQuoteNumber || finalQuoteId });
  } catch (error) {
    logger.error('Bid submission failed', { error });
    return NextResponse.json({ 
      error: 'Failed to submit bid', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
