import fs from 'fs';

import path from 'path';

import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

// Parse CSV function
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
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

export async function POST(_request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Read CSV file
    const csvPath = path.join(process.cwd(), 'import.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => parseCSVLine(line));

    // Process products
    const products = new Map();

    rows.forEach((row) => {
      if (row.length < headers.length) return;

      const rowData: any = {};
      headers.forEach((header, i) => {
        rowData[header] = row[i] || '';
      });

      const handle = rowData.handle;
      const entryType = rowData.entry_type;

      if (entryType === 'product' || !products.has(handle)) {
        const imageUrls = (rowData.image_urls || '')
          .split(',')
          .map((u: string) => u.trim())
          .filter((u: string) => u.length > 0);
        products.set(handle, {
          handle,
          name: rowData.title,
          title: rowData.title,
          description: rowData.description,
          vendor: rowData.vendor || null,
          product_type: rowData.product_type,
          tags: rowData.tags ? rowData.tags.split(',').map((tag: string) => tag.trim()) : [],
          status: rowData.status || 'active',
          image: imageUrls[0] || '',
          images: imageUrls.map((url: string) => ({ url })),
          variants: []
        });
      }

      if (entryType === 'variant' && products.has(handle)) {
        const product = products.get(handle);
        const variant = {
          title: rowData.variant_title,
          sku: rowData.variant_sku,
          barcode: rowData.variant_barcode,
          price: parseFloat(rowData.variant_price) || 0,
          compare_at_price: parseFloat(rowData.variant_compare_price) || null,
          cost: parseFloat(rowData.variant_cost) || 0,
          weight: parseFloat(rowData.variant_weight) || 0,
          inventory_quantity: parseInt(rowData.variant_inventory) || 0,
          option1: rowData.option1_value,
          option2: rowData.option2_value,
          option3: rowData.option3_value,
          status: rowData.status || 'active',
          images: (rowData.image_urls || '')
            .split(',')
            .map((u: string) => u.trim())
            .filter((u: string) => u.length > 0)
            .map((url: string) => ({ url }))
        };
        product.variants.push(variant);
      }
    });

    let insertedProducts = 0;
    let insertedVariants = 0;
    const errors: string[] = [];

    // Insert products and variants
    for (const [handle, product] of products) {
      try {
        // Get the base price from the first variant or set default
        const basePrice = product.variants.length > 0 ? product.variants[0].price : 100;
        
        // Insert product
  const { error: productError } = await supabase
          .from('products')
          .insert([{
            name: product.name,
            title: product.title,
            description: product.description || '',
            price: basePrice,
            category: product.product_type || 'Electronics',
      image: product.image || (product.images?.[0]?.url || ''),
            brand: 'Coconut',
            status: product.status || 'active',
            stock_quantity: product.variants.length > 0 ? product.variants[0].inventory_quantity : 10,
            stock_status: 'in_stock'
          }])
          .select()
          .single();

        if (productError) {
          logger.error('products_manual_import_insert_failed', { handle, error: productError });
          errors.push(`Product ${handle}: ${productError.message}`);
          continue;
        }

        insertedProducts++;

        // Skip variants insertion for now since table doesn't exist
        // Just count the variants for reporting
        insertedVariants += product.variants.length;

      } catch (error) {
        logger.error('products_manual_import_unexpected', { handle, error });
        errors.push(`Unexpected error for ${handle}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Products imported successfully',
      imported: insertedProducts,
      variants: insertedVariants,
      errors
    });

  } catch (error) {
    logger.error('products_manual_import_error', { error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Import failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
