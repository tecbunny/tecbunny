import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

import { buildPdf, loadCompanyInfo } from '../../../lib/pdf-generator';
import { createClient, createServiceClient, isSupabaseServiceConfigured } from '../../../lib/supabase/server';
import { logger } from '../../../lib/logger';

export const runtime = 'nodejs';


async function sendEmailWithAttachment(to: string, subject: string, html: string, attachment: Buffer) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('quotes.email.skipped_no_smtp');
    return { success: false, error: 'SMTP not configured' };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@tecbunny.com',
    to,
    subject,
    html,
    attachments: [
      {
        filename: 'quote.pdf',
        content: attachment,
        contentType: 'application/pdf',
      },
    ],
  });
  return { success: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { summary, selections, gstIncluded = true } = body;

    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) {
      logger.error('quotes.auth_get_user_failed', { error: authError });
    }
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prefer service role for DB writes; fall back to user client if service env is absent.
    const serviceClient = isSupabaseServiceConfigured ? createServiceClient() : null;

    let company: Record<string, any> = {};
    try {
      company = await loadCompanyInfo();
    } catch (error) {
      logger.error('quotes.load_company_info_failed', { error, userId: user.id });
    }
    const customerName = (user.user_metadata?.name as string) || user.email || 'Customer';
    const customerEmail = user.email || 'unknown@local';

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildPdf({
        company,
        customerName,
        customerEmail,
        gstIncluded,
        summary,
        selections,
      });
    } catch (error) {
      logger.error('quotes.pdf_failed', { error, userId: user.id });
      return NextResponse.json({
        error: 'Failed to generate quote',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }

    const expiryAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const dbClient = serviceClient ?? supabase;

    const insertResult = await dbClient.from('quotes').insert({
      user_id: user.id,
      customer_name: customerName,
      customer_email: customerEmail,
      gst_included: !!gstIncluded,
      expiry_at: expiryAt,
      summary: summary || null,
      selections: selections ?? null,
      status: 'created',
    });

    if (insertResult.error) {
      logger.error('quotes.insert_failed', { error: insertResult.error, userId: user.id });
      // Continue to generate and return the PDF even if the DB insert fails.
    }

    void sendEmailWithAttachment(
      customerEmail,
      'Your TecBunny Quote',
      '<p>Please find your quote attached. Valid for 7 days.</p>',
      pdfBuffer
    ).catch((error) => logger.error('quotes.email_failed', { error, userId: user.id }));

    const pdfArrayBuffer = Uint8Array.from(pdfBuffer).buffer;

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="quote.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error('quotes.create_failed', { error });
    return NextResponse.json({
      error: 'Failed to generate quote',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
