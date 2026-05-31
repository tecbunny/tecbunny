import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '../../../../lib/supabase/server';
import { logger } from '../../../../lib/logger';

// Helper function to parse CSV line with proper quote handling
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  imported: number;
  errors: ImportError[];
}

// Simple CSV import for products - compatible with current schema
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

    const csvText = await file.text();
    logger.info('CSV length:', { length: csvText.length });
    
    // Parse CSV
    const lines = csvText.split('\n').filter(line => line.trim());
    logger.info('Total lines:', { count: lines.length });
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have header and at least one data row' }, { status: 400 });
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    logger.debug('Headers:', { headers });
    
    // Validate required headers
    const requiredHeaders = ['name', 'price'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      return NextResponse.json({ 
        error: `Missing required columns: ${missingHeaders.join(', ')}` 
      }, { status: 400 });
    }

    const supabase = await createClient();
    logger.debug('Supabase client created');

    const results: ImportResult = {
      imported: 0,
      errors: []
    };

    const productsToInsert = [];

    // Process each data line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        logger.debug(`Row ${i}:`, { values });
        
        // Create row object
        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        logger.debug(`Row ${i} data:`, { rowData });

        // Validate required fields
        if (!rowData.name || !rowData.price) {
          results.errors.push({
            row: i + 1,
            field: 'required',
            message: 'Missing required fields: name or price'
          });
          continue;
        }

        // Create product object with proper data types and correct column names
        const product = {
          name: rowData.name.replace(/"/g, ''),
          description: rowData.description?.replace(/"/g, '') || '',
          price: parseFloat(rowData.price) || 0,
          category: rowData.category?.replace(/"/g, '') || 'General',
          image_url: rowData.image?.replace(/"/g, '') || rowData.image_url?.replace(/"/g, '') || '',
          popularity: parseInt(rowData.popularity) || 0,
          rating: parseFloat(rowData.rating) || 0,
          review_count: parseInt(rowData.reviewcount || rowData.review_count) || 0,
          brand: rowData.brand?.replace(/"/g, '') || '',
          offer_price: parseFloat(rowData.mrp) || null,
          hsn_code: rowData.hsncode || rowData.hsn_code || '',
          gst_rate: parseFloat(rowData.gstrate || rowData.gst_rate) || 18,
          is_serial_number_compulsory: rowData.isserialnumbercompulsory === 'true' || rowData.is_serial_number_compulsory === 'true',
          stock_quantity: parseInt(rowData.stock_quantity || rowData.stock) || 0,
          stock_status: rowData.stock_status || 'in_stock'
        };

        logger.debug(`Product ${i}:`, { product });
        productsToInsert.push(product);

      } catch (rowError) {
        logger.error(`Row ${i} error:`, { error: rowError });
        results.errors.push({
          row: i + 1,
          field: 'parsing',
          message: `Error parsing row: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`
        });
      }
    }

  logger.info('products.csv_import.ready_to_insert', { count: productsToInsert.length });

    // Insert products in batches
    if (productsToInsert.length > 0) {
      try {
        const { error: insertError } = await supabase
          .from('products')
          .insert(productsToInsert);

        if (insertError) {
          logger.error('Insert error:', { error: insertError });
          return NextResponse.json({ 
            error: `Database error: ${insertError.message}` 
          }, { status: 500 });
        }

        results.imported = productsToInsert.length;
        logger.info('Inserted products:', { count: results.imported });

      } catch (insertError) {
        logger.error('Insert exception:', { error: insertError });
        return NextResponse.json({ 
          error: `Insert failed: ${insertError instanceof Error ? insertError.message : 'Unknown error'}` 
        }, { status: 500 });
      }
    }

    logger.info('Import completed:', { results });

    return NextResponse.json({
      success: true,
      imported: results.imported,
      errors: results.errors,
      message: `Successfully imported ${results.imported} products`
    });

  } catch (error) {
    logger.error('CSV import error:', { error });
    return NextResponse.json({ 
      error: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
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
