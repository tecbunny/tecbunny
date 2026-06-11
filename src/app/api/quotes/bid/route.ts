import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { sendWhatsAppNotification } from '@/lib/whatsapp-service';

import { z } from 'zod';

const bidSchema = z.object({
  quoteId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().nullable(),
  phone: z.string().min(10, 'Invalid phone'),
  address: z.string().optional().nullable(),
  biddedPrice: z.number().positive('Bid must be strictly greater than 0'),
  summary: z.string().max(1000).optional().nullable(),
  customSetupConfig: z.any().optional().nullable()
});

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const serviceClient = createServiceClient();
    
    const json = await req.json();
    const validatedData = bidSchema.parse(json);
    const { quoteId, name, email, phone, address, biddedPrice, summary, customSetupConfig } = validatedData;


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
      // OCC / State-Machine validation
      const { data: existingQuote, error: checkError } = await serviceClient
        .from('quotes')
        .select('status')
        .eq('id', finalQuoteId)
        .single();
      
      if (checkError) throw checkError;
      
      // Explicit state lock to prevent stale updates or bypassing accepted contracts
      if (!['created', 'bidded'].includes(existingQuote.status)) {
        return NextResponse.json({ 
          error: `State Transition Error: Cannot modify a quote that is currently in '${existingQuote.status}' state.` 
        }, { status: 409 });
      }

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
