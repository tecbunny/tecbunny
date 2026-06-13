import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { logger } from '@/lib/logger';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('simple_import.supabase_configuration_missing');
      return NextResponse.json({ error: 'Service configuration error. Please contact support.' }, { status: 503 });
    }
    let text = '';
    
    // Handle both FormData (file upload) and JSON (direct CSV data)
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      
      text = await file.text();
    } else if (contentType.includes('application/json')) {
      // Direct CSV data
      const body = await request.json();
      if (!body.csvData) {
        return NextResponse.json({ error: 'No csvData provided' }, { status: 400 });
      }
      text = body.csvData;
    } else {
      return NextResponse.json({ error: 'Invalid content type. Use multipart/form-data for file upload or application/json for direct CSV data' }, { status: 400 });
    }

    // Read and parse CSV content
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 });
    }

    // Parse CSV headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const requiredHeaders = [
      'Handle ID', 'Type', 'Title', 'Brand', 'Description', 
      'Product Detail', 'Image Link', 'Warranty Details', 
      'Stock Status', 'Status'
    ];

    // Validate headers
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json({ 
        error: `Missing required columns: ${missingHeaders.join(', ')}` 
      }, { status: 400 });
    }

    const hasProductId = headers.includes('Product ID');

    // Parse data rows
    const productGroups: { [key: string]: { main: any | null; variants: any[] } } = {};

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      // Skip empty rows
      if (!row['Handle ID'] || !row['Title']) continue;

      const product = {
        handle_id: row['Handle ID'],
        type: row['Type'].toLowerCase(),
        title: row['Title'],
        brand: row['Brand'] || '',
        description: row['Description'] || '',
        product_detail: row['Product Detail'] || '',
        image_url: row['Image Link'] || '',
        warranty_details: row['Warranty Details'] || '',
        in_stock: row['Stock Status'].toLowerCase() === 'in stock',
        status: row['Status'].toLowerCase() === 'active' ? 'active' : 'inactive'
      };

      // Group by handle_id
      if (!productGroups[product.handle_id]) {
        productGroups[product.handle_id] = { main: null, variants: [] };
      }

      if (product.type === 'product') {
        productGroups[product.handle_id].main = product;
      } else if (product.type === 'variant') {
        productGroups[product.handle_id].variants.push(product);
      }
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each product group
    for (const [handleId, group] of Object.entries(productGroups)) {
      try {
        if (!group.main) {
          errors.push(`Skipping ${handleId}: No main product found`);
          continue;
        }

        const mainProduct = group.main;

        // Insert or update main product
        const { error: insertError } = await supabase
          .from('products')
          .upsert({
            handle_id: handleId,
            handle: handleId.toLowerCase(),
            title: mainProduct.title,
            description: mainProduct.description,
            brand: mainProduct.brand,
            product_detail: mainProduct.product_detail,
            image_url: mainProduct.image_url,
            warranty_details: mainProduct.warranty_details,
            in_stock: mainProduct.in_stock,
            status: mainProduct.status,
            entry_type: mainProduct.type
          }, {
            onConflict: 'handle_id'
          });

        if (insertError) {
          errors.push(`Error inserting ${handleId}: ${insertError.message}`);
          errorCount++;
          continue;
        }

        // Process variants
        for (const variant of group.variants) {
          const variantIndex = group.variants.indexOf(variant) + 1;
          const { error: variantError } = await supabase
            .from('products')
            .upsert({
              handle_id: `${handleId}-variant-${variantIndex}`,
              handle: `${handleId.toLowerCase()}-variant-${variantIndex}`,
              title: variant.title,
              description: variant.description,
              brand: variant.brand,
              product_detail: variant.product_detail,
              image_url: variant.image_url,
              warranty_details: variant.warranty_details,
              in_stock: variant.in_stock,
              status: variant.status,
              entry_type: variant.type
            }, {
              onConflict: 'handle_id'
            });

          if (variantError) {
            errors.push(`Error inserting variant for ${handleId}: ${variantError.message}`);
          }
        }

        successCount++;
      } catch (error) {
        errors.push(`Error processing ${handleId}: ${(error as Error).message}`);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import completed: ${successCount} products imported, ${errorCount} errors`,
      details: {
        successCount,
        errorCount,
        totalGroups: Object.keys(productGroups).length,
        errors: errors.slice(0, 10) // Limit error messages
      }
    });

  } catch (error) {
    logger.error('CSV import error:', { error });
    return NextResponse.json({
      error: `Import failed: ${  (error as Error).message}`
    }, { status: 500 });
  }
}

// Helper function to parse CSV line with proper quote handling
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}
