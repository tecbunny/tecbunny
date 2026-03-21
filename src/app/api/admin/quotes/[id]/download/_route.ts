import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { buildPdf, loadCompanyInfo } from '@/lib/pdf-generator';

// export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const quoteId = params.id;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { isAdmin } = await requireAdmin(user, supabase);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  const company = await loadCompanyInfo();

  try {
    const pdfBuffer = await buildPdf({
      company,
      customerName: quote.customer_name,
      customerEmail: quote.customer_email,
      gstIncluded: quote.gst_included,
      summary: quote.summary,
      selections: quote.selections,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quote-${quoteId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}

export async function generateStaticParams() {
  return []
}


