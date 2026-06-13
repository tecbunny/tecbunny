import PDFDocument from 'pdfkit';
import { logger } from './logger';

export interface CatalogueItem {
  id: string;
  name: string;
  title?: string;
  description?: string;
  price: number;
  mrp?: number;
  category: string;
  brand?: string;
}

export async function generateCataloguePdf(options: {
  products: CatalogueItem[];
  services: CatalogueItem[];
  includePricing: boolean;
  companyInfo: any;
}): Promise<Buffer> {
  const { products, services, includePricing, companyInfo } = options;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const companyName = companyInfo?.companyName || 'TECBUNNY SOLUTIONS';
      const address = companyInfo?.registeredAddress || '';
      const supportEmail = companyInfo?.supportEmail || 'support@tecbunny.com';
      const supportPhone = companyInfo?.supportPhone || '';
      const gstin = companyInfo?.gstin || '';
      const cin = companyInfo?.cin || '';

      // --- COVER PAGE ---
      // Upper Section Accent (Deep Dark Blue Tech Header)
      doc.rect(0, 0, doc.page.width, 300).fill('#0F172A');

      // Decorative cyan tech lines
      doc.strokeColor('#2563eb').lineWidth(2);
      doc.moveTo(0, 300).lineTo(doc.page.width, 300).stroke();

      // Cover Page Title Block
      doc.fillColor('#FFFFFF')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text(companyName.toUpperCase(), 50, 80, { width: doc.page.width - 100 });

      doc.fillColor('#93c5fd')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('PRODUCT & SERVICE CATALOGUE', 50, 130, { width: doc.page.width - 100 });

      doc.fillColor('#94a3b8')
         .fontSize(12)
         .font('Helvetica')
         .text('Enterprise Security, Home Automation & Structured IT Infrastructure', 50, 200);

      // Bottom Section (Whitespace)
      doc.fillColor('#1e293b')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('Corporate Information', 50, 340);

      let infoY = 370;
      doc.fontSize(10).font('Helvetica').fillColor('#475569');

      if (address) {
        doc.font('Helvetica-Bold').text('Address:', 50, infoY).font('Helvetica').text(address, 130, infoY, { width: doc.page.width - 200 });
        infoY += 35;
      }
      if (supportPhone) {
        doc.font('Helvetica-Bold').text('Phone:', 50, infoY).font('Helvetica').text(supportPhone, 130, infoY);
        infoY += 20;
      }
      if (supportEmail) {
        doc.font('Helvetica-Bold').text('Email:', 50, infoY).font('Helvetica').text(supportEmail, 130, infoY);
        infoY += 20;
      }
      if (gstin) {
        doc.font('Helvetica-Bold').text('GSTIN:', 50, infoY).font('Helvetica').text(gstin, 130, infoY);
        infoY += 20;
      }
      if (cin) {
        doc.font('Helvetica-Bold').text('CIN:', 50, infoY).font('Helvetica').text(cin, 130, infoY);
        infoY += 20;
      }

      // Cover Page Footer Note
      doc.fontSize(8)
         .fillColor('#94a3b8')
         .text('This document is private and confidential. Pricing and specifications are subject to scope verification.', 50, doc.page.height - 80, { width: doc.page.width - 100, align: 'center' });

      // --- CATALOGUE ITEMS PAGE ---
      // Combine and Group Items by Category
      const allItems = [
        ...products.map(p => ({ ...p, isProduct: true })),
        ...services.map(s => ({ ...s, isProduct: false }))
      ];

      const groupedItems: Record<string, typeof allItems> = {};
      allItems.forEach((item) => {
        const cat = item.category || 'General';
        if (!groupedItems[cat]) groupedItems[cat] = [];
        groupedItems[cat].push(item);
      });

      // Loop through categories to output items
      Object.keys(groupedItems).forEach((categoryName) => {
        doc.addPage();
        let currentY = 80;

        // Category Header
        doc.fillColor('#2563eb')
           .fontSize(16)
           .font('Helvetica-Bold')
           .text(categoryName.toUpperCase(), 50, currentY);

        doc.strokeColor('#cbd5e1')
           .lineWidth(1)
           .moveTo(50, currentY + 20)
           .lineTo(doc.page.width - 50, currentY + 20)
           .stroke();

        currentY += 35;

        // Render Catalogue Card Items
        groupedItems[categoryName].forEach((item) => {
          const itemTitle = item.title || item.name || 'Unnamed Item';
          const brandText = item.brand ? `[${item.brand}] ` : '';
          const desc = item.description || 'Premium hardware built for reliable performance.';
          
          // Estimate required height for the item card
          let cardHeight = 70;
          if (desc.length > 120) cardHeight += 15;
          if (includePricing) cardHeight += 15;

          // Check for Page Overflow
          if (currentY + cardHeight > doc.page.height - 80) {
            doc.addPage();
            currentY = 80;
            
            // Re-draw small category guide header
            doc.fillColor('#94a3b8')
               .fontSize(10)
               .font('Helvetica-Bold')
               .text(`${categoryName.toUpperCase()} (Continued)`, 50, currentY);
            currentY += 20;
          }

          // Item card container
          doc.rect(50, currentY, doc.page.width - 100, cardHeight)
             .fillAndStroke('#f8fafc', '#e2e8f0');

          // Cyan left-border highlight accent
          doc.rect(50, currentY, 4, cardHeight)
             .fill('#2563eb');

          // Text content inside card
          doc.fillColor('#0F172A')
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(`${brandText}${itemTitle}`, 65, currentY + 10, { width: doc.page.width - 140 });

          doc.fillColor('#475569')
             .fontSize(8.5)
             .font('Helvetica')
             .text(desc, 65, currentY + 25, { width: doc.page.width - 140 });

          // Pricing information
          if (includePricing) {
            const priceVal = typeof item.price === 'number' ? item.price : 0;
            const priceLabel = `Sale Price: Rs. ${priceVal.toLocaleString('en-IN')}`;
            let mrpLabel = '';
            if (item.mrp && item.mrp > priceVal) {
              mrpLabel = ` | MRP: Rs. ${item.mrp.toLocaleString('en-IN')}`;
            }

            doc.fillColor('#0F172A')
               .fontSize(9)
               .font('Helvetica-Bold')
               .text(`${priceLabel}${mrpLabel}`, 65, currentY + cardHeight - 20);
          }

          currentY += cardHeight + 15;
        });
      });

      // --- DYNAMIC HEADER & FOOTER PAGES ---
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Header (Skip on Cover Page)
        if (i > range.start) {
          doc.fillColor('#475569')
             .fontSize(8)
             .font('Helvetica-Bold')
             .text(companyName.toUpperCase(), 50, 30);

          doc.fillColor('#94a3b8')
             .fontSize(8)
             .font('Helvetica')
             .text('PRODUCT & SERVICE CATALOGUE', doc.page.width - 200, 30, { align: 'right' });

          doc.strokeColor('#e2e8f0')
             .lineWidth(0.5)
             .moveTo(50, 42)
             .lineTo(doc.page.width - 50, 42)
             .stroke();
        }

        // Footer (Page Numbers)
        const pageText = `Page ${i + 1} of ${range.count}`;
        doc.fillColor('#94a3b8')
           .fontSize(8)
           .font('Helvetica')
           .text(pageText, 50, doc.page.height - 40, { align: 'center' });
      }

      // Finish PDF write stream
      doc.end();

    } catch (error) {
      logger.error('catalog_pdf_generation_failed', { error });
      reject(error);
    }
  });
}
