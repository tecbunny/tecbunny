import { NextRequest, NextResponse } from 'next/server';

import { createServiceClient , isSupabaseServiceConfigured , createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Helper function to properly escape CSV values
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  
  const str = String(value);
  
  // If the value contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

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
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

async function fetchProductColumns(supabase: ReturnType<typeof createServiceClient>) {
  try {
    const { data, error } = await supabase
      .from('information_schema.columns' as any)
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'products');

    if (error) {
      logger.warn('products.bulk_edit.column_metadata_failed', { error: error.message });
      return null;
    }

    const columns = new Set<string>((data || []).map((row: any) => String(row.column_name)));
    logger.debug('products.bulk_edit.column_metadata', { columns: Array.from(columns) });
    return columns;
  } catch (error) {
    logger.warn('products.bulk_edit.column_metadata_unavailable', { error: (error as Error).message });
    return null;
  }
}

// Export products to CSV for bulk editing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateOnly = searchParams.get('template') === 'true';

    if (templateOnly) {
      // Return empty template for bulk import
      const headers = [
        'handle',
        'title',
        'description',
        'vendor',
        'product_type',
        'tags',
        'entry_type',
        'variant_title',
        'variant_sku',
        'variant_barcode',
        'variant_price',
        'variant_compare_price',
        'variant_cost',
        'variant_weight',
        'variant_inventory',
        'option1_name',
        'option1_value',
        'option2_name',
        'option2_value',
        'option3_name',
        'option3_value',
        'image_urls',
        'status'
      ];

      const sampleData = [
        [
          'sample-product',
          'Sample Product',
          'This is a sample product description',
          'TecBunny',
          'Electronics',
          'sample,product',
          'product',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          'Color',
          '',
          'Size',
          '',
          '',
          '',
          'https://example.com/image.jpg',
          'active'
        ],
        [
          'sample-product',
          'Sample Product - Black',
          'This is a sample product description',
          'TecBunny',
          'Electronics',
          'sample,product',
          'variant',
          'Black',
          'SAM-001-BLK',
          '1234567890',
          '999.00',
          '1299.00',
          '600.00',
          '0.5',
          '25',
          'Color',
          'Black',
          'Size',
          'Medium',
          '',
          '',
          'https://example.com/image-black.jpg',
          'active'
        ]
      ];

      const csvContent = [
        headers.map(h => escapeCsvValue(h)).join(','),
        ...sampleData.map(row => row.map(cell => escapeCsvValue(cell)).join(','))
      ].join('\n');

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="product_template.csv"'
        }
      });
    }

    const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient();
    const columns = await fetchProductColumns(supabase);

    let query = supabase.from('products').select('*');

    if (!columns || columns.has('handle')) {
      query = query.order('handle', { ascending: true });
    }

    if (columns?.has('entry_type')) {
      query = query.order('entry_type', { ascending: false });
    }

    // Get all products with their data for bulk editing
    const { data: allProducts, error } = await query;

    if (error) {
      console.error('Error fetching products for export:', error);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    // CSV headers (matching your import structure)
    const headers = [
      'handle',
      'title',
      'description',
      'vendor',
      'product_type',
      'tags',
      'entry_type',
      'variant_title',
      'variant_sku',
      'variant_barcode',
      'variant_price',
      'variant_compare_price',
      'variant_cost',
      'variant_weight',
      'variant_inventory',
      'option1_name',
      'option1_value',
      'option2_name',
      'option2_value',
      'option3_name',
      'option3_value',
      'image_urls',
      'status'
    ];

    // Generate CSV rows
    const rows: string[] = [];
    
    // Add header row
    rows.push(headers.map(h => escapeCsvValue(h)).join(','));

    // Add data rows
    allProducts?.forEach(product => {
      const row = [
        product.handle || '',
        product.title || '',
        product.description || '',
        product.vendor || '',
        product.product_type || '',
        product.tags || '',
        product.entry_type || 'product',
        product.variant_title || '',
        product.variant_sku || '',
        product.variant_barcode || '',
        product.variant_price || '',
        product.variant_compare_price || '',
        product.variant_cost || '',
        product.variant_weight || '',
        product.variant_inventory || '',
        product.option1_name || '',
        product.option1_value || '',
        product.option2_name || '',
        product.option2_value || '',
        product.option3_name || '',
        product.option3_value || '',
        product.image_urls || '',
        product.status || 'active'
      ];

      rows.push(row.map(cell => escapeCsvValue(cell)).join(','));
    });

    const csvContent = rows.join('\n');

  logger.info('products.bulk_edit.export_success', { count: allProducts?.length || 0 });

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="products_bulk_edit_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    logger.error('products.bulk_edit.export_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Import products from CSV (bulk edit without duplicates)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const csvText = await file.text();
  logger.info('products.bulk_edit.import_start');
    
    // Parse CSV lines
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have header and at least one data row' }, { status: 400 });
    }

    const headers = parseCSVLine(lines[0]);
  logger.debug('products.bulk_edit.headers_detected', { headers });
    
    // Validate required headers
    const requiredHeaders = ['handle', 'title', 'entry_type'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      return NextResponse.json({ 
        error: `Missing required columns: ${missingHeaders.join(', ')}` 
      }, { status: 400 });
    }

  const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient();
    
    let updated = 0;
    let created = 0;
    const errors: string[] = [];

    // Process each data line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        const rowData: any = {};
        
        // Map values to headers
        headers.forEach((header, index) => {
          const value = values[index]?.trim() || '';
          rowData[header] = value === '' ? null : value;
        });

        const handle = rowData.handle;
        const entryType = rowData.entry_type || 'product';

        if (!handle) {
          errors.push(`Row ${i + 1}: Missing handle`);
          continue;
        }

        // Check if product/variant already exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('handle', handle)
          .eq('entry_type', entryType)
          .single();

        // Prepare data for insert/update
        const productData = {
          handle: rowData.handle,
          title: rowData.title,
          description: rowData.description,
          vendor: rowData.vendor,
          product_type: rowData.product_type,
          tags: rowData.tags,
          entry_type: entryType,
          variant_title: rowData.variant_title,
          variant_sku: rowData.variant_sku,
          variant_barcode: rowData.variant_barcode,
          variant_price: rowData.variant_price ? parseFloat(rowData.variant_price) : null,
          variant_compare_price: rowData.variant_compare_price ? parseFloat(rowData.variant_compare_price) : null,
          variant_cost: rowData.variant_cost ? parseFloat(rowData.variant_cost) : null,
          variant_weight: rowData.variant_weight ? parseFloat(rowData.variant_weight) : null,
          variant_inventory: rowData.variant_inventory ? parseInt(rowData.variant_inventory) : null,
          option1_name: rowData.option1_name,
          option1_value: rowData.option1_value,
          option2_name: rowData.option2_name,
          option2_value: rowData.option2_value,
          option3_name: rowData.option3_name,
          option3_value: rowData.option3_value,
          image_urls: rowData.image_urls,
          status: rowData.status || 'active'
        };

        if (existing) {
          // Update existing product/variant
          const { error: updateError } = await supabase
            .from('products')
            .update(productData)
            .eq('id', existing.id);

          if (updateError) {
            errors.push(`Row ${i + 1}: Update failed - ${updateError.message}`);
          } else {
            updated++;
          }
        } else {
          // Create new product/variant
          const { error: insertError } = await supabase
            .from('products')
            .insert(productData);

          if (insertError) {
            errors.push(`Row ${i + 1}: Create failed - ${insertError.message}`);
          } else {
            created++;
          }
        }

      } catch (error) {
  logger.error('products.bulk_edit.row_processing_failed', { row: i + 1, error });
        errors.push(`Row ${i + 1}: ${(error as Error).message}`);
      }
    }

    const result = {
      success: true,
      updated,
      created,
      errors: errors.length > 0 ? errors : undefined,
      message: `Bulk edit completed: ${created} created, ${updated} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`
    };

    logger.info('products.bulk_edit.import_complete', { result });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('products.bulk_edit.import_error', { error });
    return NextResponse.json({ 
      error: 'Failed to process bulk edit', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}
