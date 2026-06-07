import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { parse } from 'csv-parse';
import { Readable } from 'stream';

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  imported: number;
  errors: ImportError[];
}

export async function POST(request: NextRequest) {
  try {
    logger.info('Starting CSV import...');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      logger.warn('No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    logger.info('File received:', { name: file.name, size: file.size });

    const supabase = await createClient();
    logger.debug('Supabase client created');

    const results: ImportResult = {
      imported: 0,
      errors: []
    };

    let productsBatch: any[] = [];
    const BATCH_SIZE = 100;
    let rowIndex = 0;

    const readable = Readable.fromWeb(file.stream() as any);
    const parser = readable.pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));

    for await (const record of parser) {
      rowIndex++;
      try {
        const rowData: Record<string, string> = Object.fromEntries(
          Object.entries(record).map(([k, v]) => [k.toLowerCase().trim(), String(v)])
        );

        if (!rowData.name || !rowData.price) {
          results.errors.push({
            row: rowIndex,
            field: 'required',
            message: 'Missing required fields: name or price'
          });
          continue;
        }

        const product = {
          name: String(rowData.name).replace(/"/g, ''),
          description: String(rowData.description || '').replace(/"/g, ''),
          price: parseFloat(rowData.price) || 0,
          category: String(rowData.category || 'General').replace(/"/g, ''),
          image_url: String(rowData.image || rowData.image_url || '').replace(/"/g, ''),
          popularity: parseInt(rowData.popularity) || 0,
          rating: parseFloat(rowData.rating) || 0,
          review_count: parseInt(rowData.reviewcount || rowData.review_count) || 0,
          brand: String(rowData.brand || '').replace(/"/g, ''),
          offer_price: parseFloat(rowData.mrp) || null,
          hsn_code: rowData.hsncode || rowData.hsn_code || '',
          gst_rate: parseFloat(rowData.gstrate || rowData.gst_rate) || 18,
          is_serial_number_compulsory: rowData.isserialnumbercompulsory === 'true' || rowData.is_serial_number_compulsory === 'true',
          stock_quantity: parseInt(rowData.stock_quantity || rowData.stock) || 0,
          stock_status: rowData.stock_status || 'in_stock'
        };

        productsBatch.push(product);

        if (productsBatch.length >= BATCH_SIZE) {
          // Use upsert with onConflict: 'name' to prevent race conditions and duplicates during re-imports
          const { error } = await supabase.from('products').upsert(productsBatch, { onConflict: 'name' });
          if (error) {
            logger.error('Batch upsert error', { error });
            results.errors.push({ row: rowIndex, field: 'db', message: 'Batch upsert failed' });
          } else {
            results.imported += productsBatch.length;
          }
          productsBatch = [];
        }

      } catch (rowError) {
        logger.error(`Row ${rowIndex} error:`, { error: rowError });
        results.errors.push({
          row: rowIndex,
          field: 'parsing',
          message: 'Failed to process row'
        });
      }
    }

    if (productsBatch.length > 0) {
      // Use upsert with onConflict: 'name' to prevent race conditions and duplicates during re-imports
      const { error } = await supabase.from('products').upsert(productsBatch, { onConflict: 'name' });
      if (error) {
        logger.error('Final batch upsert error', { error });
        results.errors.push({ row: rowIndex, field: 'db', message: 'Final batch upsert failed' });
      } else {
        results.imported += productsBatch.length;
      }
    }

    logger.info('Import complete', { results });
    return NextResponse.json(results);

  } catch (error: any) {
    logger.error('CSV import error:', error);
    return NextResponse.json(
      { error: 'Import failed: ' + error.message },
      { status: 500 }
    );
  }
}


// Export products to CSV
export async function GET() {
  try {
    logger.info('Exporting products to CSV...');
    
    const supabase = await createClient();

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Export error:', { error });
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    logger.info('Exporting products:', { count: products?.length || 0 });

    // Create CSV headers - matching database columns
    const headers = [
      'id', 'name', 'description', 'price', 'category', 'image_url',
      'popularity', 'rating', 'review_count', 'brand', 'offer_price', 
      'hsn_code', 'gst_rate', 'is_serial_number_compulsory', 'stock_quantity', 'stock_status', 'created_at'
    ];

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...(products || []).map(product => 
        headers.map(header => {
          const value = product[header];
          // Handle null/undefined values
          if (value === null || value === undefined) return '';
          // Escape commas and quotes in text values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    logger.info('CSV export completed');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="products-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    logger.error('Export error:', { error });
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}
