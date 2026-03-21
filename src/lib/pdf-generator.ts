import fs from 'fs/promises';
import path from 'path';
const fontkit = require('fontkit');
import { PDFDocument, rgb, StandardFonts, type Color } from 'pdf-lib';
import { logger } from './logger';

export async function loadCompanyInfo() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'company-info.json');
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as Record<string, any>;
  } catch (error) {
    logger.error('quotes.load_company_info_failed', { error });
    return {};
  }
}

export async function buildPdf(options: {
  company: Record<string, any>;
  customerName: string;
  customerEmail: string;
  gstIncluded: boolean;
  summary?: string;
  selections?: any;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const margin = 50;

  const { company, customerName, customerEmail, gstIncluded, summary, selections } = options;
  const today = new Date();
  const expiry = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  const fontRegularPath = path.join(fontDir, 'NotoSans-Regular.ttf');
  const fontBoldPath = path.join(fontDir, 'NotoSans-Bold.ttf');
  const remoteFontUrl =
    process.env.BRAND_FONT_URL ||
    'https://fonts.gstatic.com/s/notosans/v35/o-0IIpQlx3QUlC5A4PNr6DRAW_0.ttf';
  const remoteFontBoldUrl =
    process.env.BRAND_FONT_BOLD_URL ||
    'https://fonts.gstatic.com/s/notosans/v35/o-0IIpQlx3QUlC5A4PNr4AR5dQ.ttf';
  let fontRegularBuffer: Buffer | null = null;
  let fontBoldBuffer: Buffer | null = null;

  try {
    fontRegularBuffer = await fs.readFile(fontRegularPath);
  } catch (error) {
    // logger.warn('quotes.font_local_missing', { error });
  }
  try {
    fontBoldBuffer = await fs.readFile(fontBoldPath);
  } catch (error) {
    // logger.warn('quotes.font_bold_local_missing', { error });
  }

  if (!fontRegularBuffer) {
    try {
      const response = await fetch(remoteFontUrl);
      if (response.ok) {
        fontRegularBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        logger.warn('quotes.font_remote_failed', { status: response.status, remoteFontUrl });
      }
    } catch (error) {
      logger.error('quotes.font_remote_failed', { error, remoteFontUrl });
    }
  }

  if (!fontBoldBuffer && remoteFontBoldUrl) {
    try {
      const response = await fetch(remoteFontBoldUrl);
      if (response.ok) {
        fontBoldBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        logger.warn('quotes.font_bold_remote_failed', { status: response.status, remoteFontBoldUrl });
      }
    } catch (error) {
      logger.error('quotes.font_bold_remote_failed', { error, remoteFontBoldUrl });
    }
  }

  let bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let customFontReady = false;
  if (fontRegularBuffer) {
    try {
      pdfDoc.registerFontkit((fontkit as any).default || fontkit);
      bodyFont = await pdfDoc.embedFont(fontRegularBuffer);
      if (fontBoldBuffer) {
        boldFont = await pdfDoc.embedFont(fontBoldBuffer);
      }
      customFontReady = true;
    } catch (error) {
      logger.error('quotes.fontkit_failed', { error });
    }
  }

  const currencySymbol = customFontReady ? '₹' : 'Rs.';

  const formatCurrency = (value?: number | null) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return '—';
    }
    return `${currencySymbol}${value.toLocaleString('en-IN')}`;
  };

  const quoteId = `TBQ-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${Math.floor(today.getTime() / 1000)}`;

  const companyName = company?.companyName || company?.name || 'TecBunny Solutions';
  const address = company?.registeredAddress || company?.address || '';
  const supportEmail = company?.supportEmail || company?.email || 'support@tecbunny.com';
  const supportPhone = company?.supportPhone || company?.phone || '';
  const gstin = company?.gstin || '';
  const cin = company?.cin || '';
  const pan = company?.pan || '';

  const logoPath = path.join(process.cwd(), 'public', 'brand.png');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseLogoBucket = process.env.SUPABASE_LOGO_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_LOGO_BUCKET || '';
  const supabaseLogoPath = process.env.SUPABASE_LOGO_PATH || process.env.NEXT_PUBLIC_SUPABASE_LOGO_PATH || '';
  const supabaseLogoUrl =
    supabaseUrl && supabaseLogoBucket && supabaseLogoPath
      ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${supabaseLogoBucket.replace(/^\//, '').replace(/\/$/, '')}/${supabaseLogoPath.replace(/^\//, '')}`
      : '';
  const logoUrl =
    company?.logoUrl ||
    company?.logo_url ||
    process.env.BRAND_LOGO_URL ||
    process.env.NEXT_PUBLIC_BRAND_LOGO_URL ||
    supabaseLogoUrl ||
    '';
  let logoBuffer: Buffer | null = null;
  try {
    if (logoUrl) {
      const response = await fetch(logoUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        logoBuffer = Buffer.from(arrayBuffer);
      } else {
        logger.warn('quotes.logo_fetch_failed', { status: response.status, logoUrl });
      }
    }
  } catch (error) {
    logger.error('quotes.logo_fetch_failed', { error, logoUrl });
  }

  if (!logoBuffer) {
    try {
      logoBuffer = await fs.readFile(logoPath);
    } catch (error) {
      logger.error('quotes.logo_load_failed', { error });
    }
  }
  const hasLogo = Boolean(logoBuffer);

  const sanitizeText = (value?: string | null) => {
    if (!value) return '';
    return customFontReady ? value : value.replace(/₹/g, 'Rs.');
  };

  const wrapText = (text: string, font: any, fontSize: number, maxWidth: number) => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, font: any, fontSize: number, color: Color) => {
    const lines = wrapText(text, font, fontSize, maxWidth);
    const lineHeight = fontSize + 4;
    lines.forEach((line, index) => {
      page.drawText(line, { x, y: y - index * lineHeight, size: fontSize, font, color });
    });
    return y - lines.length * lineHeight;
  };

  let cursorY = pageHeight - margin;
  const headerLeftX = hasLogo ? margin + 60 : margin;
  const headerRightX = pageWidth - margin;
  const headerRightBlockWidth = 160;
  const headerLeftMaxWidth = pageWidth - margin * 2 - headerRightBlockWidth - (hasLogo ? 10 : 0);

  let logoDims = null as null | { width: number; height: number };
  let logoImage: any = null;
  if (hasLogo && logoBuffer) {
    try {
      logoImage = await pdfDoc.embedPng(logoBuffer);
      logoDims = { width: 48, height: (logoImage.height / logoImage.width) * 48 };
    } catch {
      try {
        logoImage = await pdfDoc.embedJpg(logoBuffer);
        logoDims = { width: 48, height: (logoImage.height / logoImage.width) * 48 };
      } catch {
        logoImage = null;
      }
    }
  }

  if (logoImage && logoDims) {
    page.drawImage(logoImage, {
      x: margin,
      y: cursorY - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    });
  }

  const companyNameY = cursorY - 18;
  let leftY = drawWrappedText(companyName, headerLeftX, companyNameY, headerLeftMaxWidth, boldFont, 16, rgb(0.06, 0.09, 0.16));
  leftY = drawWrappedText(address, headerLeftX, leftY, headerLeftMaxWidth, bodyFont, 9, rgb(0.28, 0.33, 0.39));
  const companyLine = [gstin ? `GSTIN: ${gstin}` : null, cin ? `CIN: ${cin}` : null, pan ? `PAN: ${pan}` : null]
    .filter(Boolean)
    .join(' | ');
  if (companyLine) {
    leftY = drawWrappedText(companyLine, headerLeftX, leftY, 260, bodyFont, 9, rgb(0.28, 0.33, 0.39));
  }
  leftY = drawWrappedText([supportPhone ? `Phone: ${supportPhone}` : null, `Email: ${supportEmail}`].filter(Boolean).join(' | '), headerLeftX, leftY, 260, bodyFont, 9, rgb(0.28, 0.33, 0.39));

  const rightHeaderY = cursorY - 14;
  const quoteTitle = 'QUOTATION';
  const quoteTitleWidth = boldFont.widthOfTextAtSize(quoteTitle, 16);
  page.drawText(quoteTitle, { x: headerRightX - quoteTitleWidth, y: rightHeaderY, size: 16, font: boldFont, color: rgb(0.06, 0.09, 0.16) });
  const quoteLines = [`Quote No: ${quoteId}`, `Quote Date: ${today.toDateString()}`, `Valid Till: ${expiry.toDateString()}`];
  let rightY = rightHeaderY - 16;
  quoteLines.forEach((line) => {
    const width = bodyFont.widthOfTextAtSize(line, 9);
    page.drawText(line, { x: headerRightX - width, y: rightY, size: 9, font: bodyFont, color: rgb(0.28, 0.33, 0.39) });
    rightY -= 12;
  });

  cursorY = Math.min(leftY, rightY) - 16;
  page.drawLine({ start: { x: margin, y: cursorY }, end: { x: pageWidth - margin, y: cursorY }, thickness: 1, color: rgb(0.89, 0.92, 0.94) });
  cursorY -= 18;

  if (logoImage && logoDims) {
    const watermarkSize = 220;
    page.drawImage(logoImage, {
      x: (pageWidth - watermarkSize) / 2,
      y: (pageHeight - watermarkSize) / 2 - 40,
      width: watermarkSize,
      height: watermarkSize,
      opacity: 0.08,
    });
  }

  page.drawText('Customer Details', { x: margin, y: cursorY, size: 11, font: boldFont, color: rgb(0.06, 0.09, 0.16) });
  cursorY -= 14;
  page.drawText(customerName, { x: margin, y: cursorY, size: 10, font: bodyFont, color: rgb(0.20, 0.25, 0.33) });
  cursorY -= 12;
  page.drawText(customerEmail, { x: margin, y: cursorY, size: 10, font: bodyFont, color: rgb(0.20, 0.25, 0.33) });

  cursorY -= 18;
  const summaryText = sanitizeText(summary || 'Customised setup request');
  const summaryBoxHeight = 50;
  page.drawRectangle({ x: margin, y: cursorY - summaryBoxHeight, width: pageWidth - margin * 2, height: summaryBoxHeight, color: rgb(0.97, 0.98, 0.99) });
  page.drawText('Project Summary', { x: margin + 12, y: cursorY - 16, size: 10, font: boldFont, color: rgb(0.06, 0.09, 0.16) });
  drawWrappedText(summaryText, margin + 12, cursorY - 30, pageWidth - margin * 2 - 24, bodyFont, 9, rgb(0.20, 0.25, 0.33));
  cursorY -= summaryBoxHeight + 18;

  const items: Array<{ description: string; mrp?: number | null; sale?: number | null }> = Array.isArray(selections?.items)
    ? selections.items.map((item: any) => ({
        ...item,
        description: sanitizeText(item?.description ?? ''),
      }))
    : [];

  if (!items.length) {
    items.push({
      description: summaryText,
      mrp: selections?.totals?.mrp ?? null,
      sale: selections?.totals?.sale ?? null,
    });
  }

  const tableTop = cursorY;
  const tableWidth = pageWidth - margin * 2;
  const colDescription = margin + 8;
  const colMrp = margin + tableWidth - 170;
  const colSale = margin + tableWidth - 90;

  page.drawText('Item Description', { x: colDescription, y: tableTop, size: 10, font: boldFont, color: rgb(0.06, 0.09, 0.16) });
  page.drawText('MRP', { x: colMrp, y: tableTop, size: 10, font: boldFont, color: rgb(0.06, 0.09, 0.16) });
  page.drawText('Sale', { x: colSale, y: tableTop, size: 10, font: boldFont, color: rgb(0.06, 0.09, 0.16) });
  page.drawLine({ start: { x: margin, y: tableTop - 8 }, end: { x: pageWidth - margin, y: tableTop - 8 }, thickness: 1, color: rgb(0.89, 0.92, 0.94) });

  let rowY = tableTop - 24;
  items.forEach((item) => {
    const description = item.description || 'Item';
    const afterDescY = drawWrappedText(description, colDescription, rowY + 6, colMrp - colDescription - 12, bodyFont, 9, rgb(0.20, 0.25, 0.33));
    page.drawText(formatCurrency(item.mrp), { x: colMrp, y: rowY, size: 9, font: bodyFont, color: rgb(0.20, 0.25, 0.33) });
    page.drawText(formatCurrency(item.sale), { x: colSale, y: rowY, size: 9, font: bodyFont, color: rgb(0.20, 0.25, 0.33) });
    const rowHeight = Math.max(18, (rowY + 6) - afterDescY + 6);
    rowY -= rowHeight;
  });

  page.drawLine({ start: { x: margin, y: rowY }, end: { x: pageWidth - margin, y: rowY }, thickness: 1, color: rgb(0.89, 0.92, 0.94) });

  const totals = selections?.totals || {};
  const mrpTotal = typeof totals.mrp === 'number' ? totals.mrp : items.reduce((sum, item) => sum + (item.mrp ?? 0), 0);
  const saleTotal = typeof totals.sale === 'number' ? totals.sale : items.reduce((sum, item) => sum + (item.sale ?? 0), 0);
  const discountAmount = typeof totals.discountAmount === 'number' ? totals.discountAmount : Math.max(0, mrpTotal - saleTotal);
  const discountPercent = typeof totals.discountPercent === 'number' ? totals.discountPercent : (mrpTotal > 0 ? (discountAmount / mrpTotal) * 100 : 0);

  const summaryBoxTop = rowY - 12;
  const summaryBoxLeft = margin + tableWidth - 240;
  page.drawRectangle({ x: summaryBoxLeft, y: summaryBoxTop - 78, width: 240, height: 78, color: rgb(0.88, 0.95, 0.99) });
  page.drawText('Pricing Summary', { x: summaryBoxLeft + 10, y: summaryBoxTop - 18, size: 10, font: boldFont, color: rgb(0.06, 0.09, 0.16) });
  page.drawText(`MRP Total: ${formatCurrency(mrpTotal)}`, { x: summaryBoxLeft + 10, y: summaryBoxTop - 34, size: 9, font: bodyFont, color: rgb(0.20, 0.25, 0.33) });
  page.drawText(`Sale Total: ${formatCurrency(saleTotal)}`, { x: summaryBoxLeft + 10, y: summaryBoxTop - 48, size: 9, font: bodyFont, color: rgb(0.20, 0.25, 0.33) });
  page.drawText(`Savings: ${formatCurrency(discountAmount)} (${discountPercent.toFixed(1)}%)`, { x: summaryBoxLeft + 10, y: summaryBoxTop - 62, size: 9, font: bodyFont, color: rgb(0.20, 0.25, 0.33) });

  cursorY = summaryBoxTop - 90;
  const gstLine = gstIncluded ? 'GST included in the above prices.' : 'GST extra (as applicable).';
  page.drawText(gstLine, { x: margin, y: cursorY, size: 9, font: bodyFont, color: rgb(0.28, 0.33, 0.39) });
  cursorY -= 12;
  page.drawText('Quote valid for 7 days. Final billing will follow site survey and scope confirmation.', {
    x: margin,
    y: cursorY,
    size: 9,
    font: bodyFont,
    color: rgb(0.28, 0.33, 0.39),
  });

  if (Array.isArray(selections?.breakdown) && selections.breakdown.length) {
    cursorY -= 18;
    page.drawText('System Breakdown', { x: margin, y: cursorY, size: 9, font: boldFont, color: rgb(0.06, 0.09, 0.16) });
    cursorY -= 12;
    const breakdownText = sanitizeText(selections.breakdown.join(' • '));
    drawWrappedText(breakdownText, margin, cursorY, pageWidth - margin * 2, bodyFont, 8, rgb(0.39, 0.45, 0.52));
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}