import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { buildPdf, loadCompanyInfo } from '@/lib/pdf-generator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = supabase.from('quotes').select('*');
    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('quote_number', id);
    }

    const { data, error } = await query.single();

    if (error || !data) throw error || new Error('Quote not found');

    const formatParam = req.nextUrl.searchParams.get('format');
    if (formatParam === 'pdf') {
      const company = await loadCompanyInfo();
      const pdfBuffer = await buildPdf({
        company,
        customerName: data.customer_name,
        customerEmail: data.customer_email,
        gstIncluded: data.gst_included,
        summary: data.summary,
        selections: data.selections,
        quoteNumber: data.quote_number,
      });

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="quote-${data.quote_number || data.id}.pdf"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch quote' },
      { status: 400 }
    );
  }
}
