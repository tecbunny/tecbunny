import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';


import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { getCustomSetupBlueprintSummary } from '@/lib/custom-setup-service';
import { DEFAULT_CUSTOM_SETUP_TEMPLATE_SLUG } from '@/lib/custom-setup.constants';
import {
  buildPricingCatalog,
  calculateTotals,
  FALLBACK_HDD_OPTIONS
} from '@/lib/custom-setup-pricing';

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
    const { 
      summary, 
      selections, 
      gstIncluded = true, 
      customSetupConfig, 
      customerName: anonName, 
      customerPhone: anonPhone, 
      customerAddress: anonAddress, 
      customerEmail: anonEmail,
      quote_number: bodyQuoteNumber,
      biddedPrice,
      status: bodyStatus
    } = body;

    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user;

    let customerName = anonName;
    let customerPhone = anonPhone;
    let customerAddress = anonAddress;
    let customerEmail = anonEmail;

    if (user) {
      customerName = customerName || (user.user_metadata?.name as string) || user.email || 'Customer';
      customerEmail = customerEmail || user.email || 'unknown@local';
      customerPhone = customerPhone || (user.user_metadata?.phone as string) || '';
    }

    if (!customerName) {
      customerName = 'Customer';
    }
    if (!customerEmail) {
      customerEmail = 'anonymous@tecbunny.com';
    }

    let finalSelections = selections;
    if (customSetupConfig) {
      const blueprint = await getCustomSetupBlueprintSummary(DEFAULT_CUSTOM_SETUP_TEMPLATE_SLUG);
      const pricingCatalog = buildPricingCatalog(blueprint);

      // Fetch accessory pricing overrides from settings
      let overrides = null;
      try {
        const serviceSupabase = await createServiceClient();
        const { data: settingData } = await serviceSupabase
          .from('settings')
          .select('*')
          .eq('key', 'custom_setup_accessory_pricing')
          .maybeSingle();
        if (settingData && settingData.value) {
          overrides = settingData.value;
        }
      } catch (err) {
        logger.error('quotes.fetch_accessory_pricing_failed', { error: err });
      }

      const {
        system,
        cameraCount,
        itSystemCount = 0,
        analogSelections,
        ipSelections,
        hddId,
        monitorIncluded,
        monitorId = 'monitor-19',
        wallMountIncluded = false,
        spikeGuardIncluded = false,
        rackId = null,
        conduitPipeId = null,
        conduitMeters = 0,
        installationIncluded,
        automationEnabled = true,
      } = customSetupConfig;

      const totals = calculateTotals({
        system,
        cameraCount,
        analogSelections,
        ipSelections,
        hddId,
        monitorIncluded,
        monitorId,
        wallMountIncluded,
        spikeGuardIncluded,
        rackId,
        conduitPipeId,
        conduitMeters,
        installationIncluded,
        automationEnabled,
        pricingCatalog,
        accessoryPricingOverrides: overrides,
      });

      const systemLabel = system === 'analog' ? 'Analog DVR' : 'IP NVR';
      const selectableHddOptions = pricingCatalog.hddOptions.length ? pricingCatalog.hddOptions : FALLBACK_HDD_OPTIONS;
      const hddLabel = selectableHddOptions.find((entry) => entry.id === hddId)?.label ?? 'Surveillance HDD';
      const installationOption = pricingCatalog.installationOption;

      const items = [
        {
          description: `${systemLabel} system (${cameraCount} cameras)`,
          mrp: totals.system.mrp,
          sale: totals.system.sale,
        },
        {
          description: hddLabel,
          mrp: totals.hdd.mrp,
          sale: totals.hdd.sale,
        },
      ];

      if (totals.monitor.included) {
        items.push({
          description: `Monitor (${totals.monitor.label})`,
          mrp: totals.monitor.mrp,
          sale: totals.monitor.sale,
        });
      }

      if (totals.wallMount.included) {
        items.push({
          description: 'Wall Mount Installation Kit',
          mrp: totals.wallMount.mrp,
          sale: totals.wallMount.sale,
        });
      }

      if (totals.spikeGuard.included) {
        items.push({
          description: 'Spike Guard / Power Surge Protector',
          mrp: totals.spikeGuard.mrp,
          sale: totals.spikeGuard.sale,
        });
      }

      if (totals.rack.selected) {
        items.push({
          description: totals.rack.label,
          mrp: totals.rack.mrp,
          sale: totals.rack.sale,
        });
      }

      if (totals.conduit.selected) {
        items.push({
          description: `${totals.conduit.label} × ${totals.conduit.meters}m`,
          mrp: totals.conduit.mrp,
          sale: totals.conduit.sale,
        });
      }

      if (totals.installation.included) {
        items.push({
          description: `Installation (${installationOption.label})`,
          mrp: totals.installation.mrp,
          sale: totals.installation.sale,
        });
      }

      if (totals.installationLabor.sale > 0) {
        items.push({
          description: `Installation Labor (₹${totals.installationLabor.sale})`,
          mrp: totals.installationLabor.sale,
          sale: totals.installationLabor.sale,
        });
      }

      if (itSystemCount > 0) {
        items.push({
          description: `IT Systems (${itSystemCount} ${itSystemCount > 1 ? 'Systems' : 'System'})`,
          mrp: 0,
          sale: 0,
        });
      }

      finalSelections = {
        type: 'customised_setup',
        systemType: systemLabel,
        cameraCount,
        items,
        totals: totals.overall,
        breakdown: totals.system.breakdown,
      };
    }

    let company: Record<string, any> = {};
    try {
      const { loadCompanyInfo } = await import('@/lib/pdf-generator');
      company = await loadCompanyInfo();
    } catch (error) {
      logger.error('quotes.load_company_info_failed', { error, userId: user?.id });
    }

    const quoteNumber = bodyQuoteNumber || `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(10000 + Math.random() * 90000))}`;
    const statusVal = bodyStatus || 'created';

    let pdfBuffer: Buffer;
    try {
      const { buildPdf } = await import('@/lib/pdf-generator');
      pdfBuffer = await buildPdf({
        company,
        customerName,
        customerEmail,
        gstIncluded,
        summary,
        selections: finalSelections,
        quoteNumber,
      });
    } catch (error) {
      logger.error('quotes.pdf_failed', { error, userId: user?.id });
      return NextResponse.json({
        error: 'Failed to generate quote',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }

    const expiryAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const serviceClient = createServiceClient();
    const insertResult = await serviceClient.from('quotes').insert({
      user_id: user?.id || null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      customer_address: customerAddress || null,
      bidded_price: biddedPrice != null ? Number(biddedPrice) : null,
      quote_number: quoteNumber,
      gst_included: !!gstIncluded,
      expiry_at: expiryAt,
      summary: summary || null,
      selections: finalSelections ?? null,
      status: statusVal,
    }).select('id, quote_number').single();

    if (insertResult.error) {
      logger.error('quotes.insert_failed', { error: insertResult.error, userId: user?.id });
    }

    const finalQuoteNumber = insertResult.data?.quote_number || quoteNumber;

    if (customerEmail && customerEmail !== 'anonymous@tecbunny.com') {
      void sendEmailWithAttachment(
        customerEmail,
        'Your TecBunny Quote',
        `<p>Please find your quote attached. Valid for 7 days. Your quote number is <strong>${finalQuoteNumber}</strong>.</p>`,
        pdfBuffer
      ).catch((error) => logger.error('quotes.email_failed', { error, userId: user?.id }));
    }

    const pdfArrayBuffer = Uint8Array.from(pdfBuffer).buffer;

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quote-${finalQuoteNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'X-Quote-Number': finalQuoteNumber,
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
