import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { buildPdf, loadCompanyInfo } from '@/lib/pdf-generator';
import { logger } from '@/lib/logger';

// export const dynamic = 'force-dynamic';

const MAX_CONCURRENT_QUOTE_PDFS = Number.parseInt(process.env.MAX_CONCURRENT_QUOTE_PDFS || '2', 10);
const MAX_QUEUED_QUOTE_PDFS = Number.parseInt(process.env.MAX_QUEUED_QUOTE_PDFS || '4', 10);
const QUOTE_PDF_QUEUE_TIMEOUT_MS = 10_000;

let activeQuotePdfBuilds = 0;
const quotePdfQueue: Array<() => void> = [];

async function acquireQuotePdfSlot(): Promise<() => void> {
  const maxConcurrent = Number.isFinite(MAX_CONCURRENT_QUOTE_PDFS) && MAX_CONCURRENT_QUOTE_PDFS > 0
    ? MAX_CONCURRENT_QUOTE_PDFS
    : 2;

  if (activeQuotePdfBuilds < maxConcurrent) {
    activeQuotePdfBuilds += 1;
    return releaseQuotePdfSlot;
  }

  if (quotePdfQueue.length >= MAX_QUEUED_QUOTE_PDFS) {
    throw new Error('QUOTE_PDF_QUEUE_FULL');
  }

  return new Promise((resolve, reject) => {
    const run = () => {
      clearTimeout(timeout);
      activeQuotePdfBuilds += 1;
      resolve(releaseQuotePdfSlot);
    };

    const timeout = setTimeout(() => {
      const index = quotePdfQueue.indexOf(run);
      if (index >= 0) {
        quotePdfQueue.splice(index, 1);
      }
      reject(new Error('QUOTE_PDF_QUEUE_TIMEOUT'));
    }, QUOTE_PDF_QUEUE_TIMEOUT_MS);

    quotePdfQueue.push(run);
  });
}

function releaseQuotePdfSlot() {
  activeQuotePdfBuilds = Math.max(0, activeQuotePdfBuilds - 1);
  const next = quotePdfQueue.shift();
  if (next) {
    next();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const quoteId = (await params).id;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { isAdmin } = await requireAdmin(user, supabase);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quoteId);
  let query = supabase.from('quotes').select('*');
  if (isUuid) {
    query = query.eq('id', quoteId);
  } else {
    query = query.eq('quote_number', quoteId);
  }

  const { data: quote, error } = await query.single();

  if (error || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  const company = await loadCompanyInfo();

  let releasePdfSlot: (() => void) | null = null;
  try {
    releasePdfSlot = await acquireQuotePdfSlot();
    const pdfBuffer = await buildPdf({
      company,
      customerName: quote.customer_name,
      customerEmail: quote.customer_email,
      gstIncluded: quote.gst_included,
      summary: quote.summary,
      selections: quote.selections,
      quoteNumber: quote.quote_number,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quote-${quote.quote_number || quote.id}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === 'QUOTE_PDF_QUEUE_FULL' || message === 'QUOTE_PDF_QUEUE_TIMEOUT') {
      logger.warn('admin_quote_pdf_queue_saturated', {
        quoteId,
        active: activeQuotePdfBuilds,
        queued: quotePdfQueue.length,
        reason: message
      });
      return NextResponse.json({ error: 'Quote PDF generation is busy. Please retry shortly.' }, { status: 429 });
    }

    if (message.includes('too many line items') || message.includes('exceeds')) {
      logger.warn('admin_quote_pdf_size_rejected', { quoteId, error: message });
      return NextResponse.json({ error: message }, { status: 413 });
    }

    logger.error('admin_quote_pdf_failed', { quoteId, error: message });
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  } finally {
    releasePdfSlot?.();
  }
}




