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
    if (customSetupConfig?.totals?.sale) {
      originalPrice = customSetupConfig.totals.sale;
    } else {
      // If customSetupConfig doesn't have totals, try to extract from selections
      // This is a fallback; ideally the frontend should pass the total
      const selections = customSetupConfig || {};
      // Estimate or return error - for now we'll allow it if no data
    }

    const minBidPrice = originalPrice * 0.7; // 70% minimum

    if (originalPrice > 0 && biddedPrice < minBidPrice) {
      return NextResponse.json({ 
        error: `Bid price must be at least ₹${Math.round(minBidPrice).toLocaleString()} (70% of quoted price)` 
      }, { status: 400 });
    }

    let finalQuoteId = quoteId;

    // If no quoteId exists yet, create one
    if (!finalQuoteId) {
      const { data, error } = await serviceClient.from('quotes').insert({
        user_id: session?.user?.id || null,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        customer_address: address,
        bidded_price: biddedPrice,
        summary: summary,
        selections: customSetupConfig,
        status: 'bidded',
        expiry_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }).select('id').single();

      if (error) throw error;
      finalQuoteId = data.id;
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

    return NextResponse.json({ success: true, quoteId: finalQuoteId });
  } catch (error) {
    logger.error('Bid submission failed', { error });
    return NextResponse.json({ error: 'Failed to submit bid' }, { status: 500 });
  }
}
