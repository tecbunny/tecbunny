import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { ProductImportRow } from '@/lib/types/products';
import { logger } from '@/lib/logger';
import sanitizeHtml from '@/lib/sanitize-html';

async function ensureProductColumns(supabase: any) {
  try {
    const { data, error } = await supabase
      .from('information_schema.columns' as any)
      .select('column_name, is_nullable, data_type')
      .eq('table_name', 'products');
    if (error) throw error;
    const columns = new Set((data || []).map((c: any) => c.column_name));
    const meta = (data || []).reduce((acc: any, c: any) => {
      acc[c.column_name] = { nullable: c.is_nullable === 'YES', data_type: c.data_type };
      return acc;
    }, {});
    logger.debug('import_product_columns_fetched', { columns: Array.from(columns), meta });
    return { columns, meta };
  } catch (e) {
    logger.warn('import_product_columns_fetch_failed', { error: (e as Error).message });
    return { columns: new Set(), meta: {} };
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
  success: number;
  errors: ImportError[];
  created_products: string[];
  updated_products: string[];
}

// Export products as CSV template
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const template_only = searchParams.get('template_only') === 'true';

    if (template_only) {
      // Return empty template for import
      const template = `handle,title,description,vendor,product_type,tags,entry_type,variant_title,variant_sku,variant_barcode,variant_price,variant_compare_price,variant_cost,variant_weight,variant_inventory,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value,image_urls,status
del123,Mouse M16,Gaming mouse with RGB lighting,Dell,Electronics,"gaming,mouse",product,,,,,,,,,Color,,Size,,,https://example.com/mouse.jpg,active
del123,Mouse M16 Black,Gaming mouse with RGB lighting,Dell,Electronics,"gaming,mouse",variant,Black Mouse,DEL123-BLK,1234567890,99.99,129.99,60.00,0.2,50,Color,Black,Size,Medium,,,https://example.com/mouse-black.jpg,active
del123,Mouse M16 White,Gaming mouse with RGB lighting,Dell,Electronics,"gaming,mouse",variant,White Mouse,DEL123-WHT,1234567891,99.99,129.99,60.00,0.2,30,Color,White,Size,Medium,,,https://example.com/mouse-white.jpg,active`;

      return new Response(template, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="product_template.csv"'
        }
      });
    }

    const supabase = await createClient();

    // Get all products with their variants and options
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        product_options(*),
        product_variants(*)
      `)
      .order('handle');

    if (error) {
      logger.error('Error fetching products for export:', { error });
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    // Generate CSV headers
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
    const rows: string[][] = [];
    
    products.forEach(product => {
      const baseRow = [
        product.handle,
        product.title,
        product.description || '',
        product.vendor || '',
        product.product_type || '',
        (product.tags || []).join(','),
        'product', // entry_type
        '', // variant_title
        '', // variant_sku
        '', // variant_barcode
        '', // variant_price
        '', // variant_compare_price
        '', // variant_cost
        '', // variant_weight
        '', // variant_inventory
        product.product_options?.[0]?.name || '',
        '', // option1_value (empty for base product)
        product.product_options?.[1]?.name || '',
        '', // option2_value
        product.product_options?.[2]?.name || '',
        '', // option3_value
        (product.images || []).map((img: any) => img.url).join(','),
        product.status
      ];
      
      rows.push(baseRow);

      // Add variant rows
      if (product.product_variants && product.product_variants.length > 0) {
        product.product_variants.forEach((variant: any) => {
          const variantRow = [
            product.handle, // Same handle
            product.title,
            product.description || '',
            product.vendor || '',
            product.product_type || '',
            (product.tags || []).join(','),
            'variant', // entry_type
            variant.title || '',
            variant.sku || '',
            variant.barcode || '',
            variant.price?.toString() || '',
            variant.compare_at_price?.toString() || '',
            variant.cost_per_item?.toString() || '',
            variant.weight?.toString() || '',
            variant.inventory_quantity?.toString() || '',
            product.product_options?.[0]?.name || '',
            variant.option1 || '',
            product.product_options?.[1]?.name || '',
            variant.option2 || '',
            product.product_options?.[2]?.name || '',
            variant.option3 || '',
            '', // image_urls (could be variant specific)
            variant.status
          ];
          
          rows.push(variantRow);
        });
      }
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="products_export.csv"'
      }
    });

  } catch (error) {
    logger.error('Export API error:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Import products from CSV
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const csvText = await file.text();
    logger.debug('CSV text preview:', { preview: csvText.substring(0, 500) });
    logger.info('CSV total length:', { length: csvText.length });
    
    // Better CSV parsing - handle quoted fields and multiline records
    function splitCSVRecords(text: string): string[] {
      const recs: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
          if (inQuotes && text[i + 1] === '"') { // escaped quote
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
            cur += ch; // keep quote for field parser
          }
        } else if ((ch === '\n') && !inQuotes) {
          if (cur.trim().length) recs.push(cur);
          cur = '';
        } else if (ch === '\r') {
          // ignore CR (normalize CRLF)
          continue;
        } else {
          cur += ch;
        }
      }
      if (cur.trim().length) recs.push(cur);
      return recs;
    }
    const lines = splitCSVRecords(csvText);
    logger.info('Filtered lines count:', { count: lines.length });
    logger.debug('First few lines:', { lines: lines.slice(0, 3) });
    
  // Raw headers from first line
  const rawHeaders = parseCSVLine(lines[0]);
  // Sanitize headers: strip BOM, trim, lower-case canonical names while preserving original for mapping
  const headers = rawHeaders.map(h => h.replace(/^\uFEFF/, '').replace(/\ufeff/g, '').trim());
  // Map header indices to canonical field names (keep original case if needed)
  const canonicalHeaders = headers.map(h => h.toLowerCase());
    // Aliases for canonical mapping
    const headerAliases: Record<string,string> = {
      'handle':'handle', 'product_handle':'handle',
  'handleid':'handle',
      'title':'title', 'product_title':'title', 'name':'title',
      'description':'description', 'body_html':'description',
      'vendor':'vendor', 'brand':'vendor',
  'product_type':'product_type','type':'product_type','category':'product_type','collection':'product_type',
      'tags':'tags','tag':'tags',
  'entry_type':'entry_type','row_type':'entry_type','kind':'entry_type','fieldtype':'entry_type',
      'variant_title':'variant_title','v_title':'variant_title',
      'variant_sku':'variant_sku','sku':'variant_sku','v_sku':'variant_sku',
      'variant_barcode':'variant_barcode','barcode':'variant_barcode',
      'variant_price':'variant_price','price':'variant_price','v_price':'variant_price',
      'variant_compare_price':'variant_compare_price','compare_at_price':'variant_compare_price','compare_price':'variant_compare_price',
      'variant_cost':'variant_cost','cost':'variant_cost','cost_per_item':'variant_cost',
      'variant_weight':'variant_weight','weight':'variant_weight',
      'variant_inventory':'variant_inventory','inventory':'variant_inventory','inventory_quantity':'variant_inventory',
  'option1_name':'option1_name','option1':'option1_name','option1_name/values':'option1_name','productoptionname1':'option1_name',
      'option1_value':'option1_value','option1val':'option1_value','option1_value/values':'option1_value',
  'option2_name':'option2_name','option2':'option2_name','productoptionname2':'option2_name',
      'option2_value':'option2_value',
  'option3_name':'option3_name','option3':'option3_name','productoptionname3':'option3_name',
  'productoptionname4':'option4_name','productoptionname5':'option5_name','productoptionname6':'option6_name',
      'option3_value':'option3_value',
  'image_urls':'image_urls','images':'image_urls','image':'image_urls','image_url':'image_urls','productimageurl':'image_urls',
  'status':'status','visible':'status'
    };
    
    logger.debug('Parsed headers:', { headers });
    
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const results: ImportResult = {
      success: 0,
      errors: [],
      created_products: [],
      updated_products: []
    };

    // Pre-scan to collect first variant prices per handle (used if base product requires price NOT NULL)
    const firstVariantPriceByHandle: Record<string, number> = {};
    try {
      if (lines.length > 1) {
        for (let i = 1; i < lines.length; i++) {
          const l = lines[i];
          if (!l.trim()) continue;
          const vals = parseCSVLine(l);
          const row: Record<string,string> = {};
          headers.forEach((h, idx) => { const canon = canonicalHeaders[idx]; const mapped = headerAliases[canon]; const v = (vals[idx]||'').trim(); if (mapped) row[mapped]=v; else row[h]=v; });
          const et = (row.entry_type||'').toLowerCase();
          if (et === 'variant') {
            const handle = row.handle;
            const vpRaw = row.variant_price || '';
            if (handle && vpRaw && !firstVariantPriceByHandle[handle]) {
              const num = parseFloat(vpRaw);
              if (!isNaN(num) && num >= 0) firstVariantPriceByHandle[handle] = num;
            }
          }
        }
      }
    } catch (e) {
      logger.warn('import_variant_price_prescan_failed', { error: (e as Error).message });
    }

    // Track products to update option values
    const productOptions: { [productId: string]: { [optionName: string]: Set<string> } } = {};
    // Debug counters
  let productRows = 0;
    let variantRows = 0;
    let productFallbacks = 0;
    let productFinalFailures = 0;
  let debugFirstProductPayload: any = null;
  let debugFirstProductError: any = null;

    // Process each line
    logger.debug('CSV Headers:', { headers });
    logger.info('Total lines:', { count: lines.length });
    
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      logger.debug(`Processing line ${i}:`, { line });

      try {
        // Parse CSV line with proper quote handling
        const values = parseCSVLine(line);
        logger.debug('Parsed values:', { values });
        
        const rowData: any = {};
        headers.forEach((header: string, index: number) => {
          const canonical = canonicalHeaders[index];
          const val = (values[index] || '').trim();
          const mapped = headerAliases[canonical];
          if (mapped) {
            rowData[mapped] = val;
          } else {
            rowData[header] = val; // fallback to raw header name
          }
          // Normalize some aliases just in case
          if (canonical === 'images') {
            rowData['image_urls'] = val;
          }
          rowData[header] = val;
        });

        // Support BOM-affected first column (e.g., "\uFEFFhandle") by copying to handle if missing
        if (!('handle' in rowData)) {
          const bomKey = Object.keys(rowData).find(k => k.replace(/^\uFEFF/, '') === 'handle');
          if (bomKey) rowData.handle = rowData[bomKey];
        }

        logger.debug('Row data:', { rowData });
        const importRow = rowData as ProductImportRow;

        // Normalize entry_type and status before any checks
        let normalizedEntryType = '' as string;
        if (typeof importRow.entry_type === 'string') {
          const et = importRow.entry_type.trim().toLowerCase();
          if (et === 'product' || et === 'variant') normalizedEntryType = et;
        }
        importRow.entry_type = normalizedEntryType as any;

        if (typeof importRow.status === 'string') {
          const sv = importRow.status.trim().toLowerCase();
          if (['true','1','active','yes','published','visible'].includes(sv)) importRow.status = 'active' as any;
          else if (['false','0','inactive','no','unpublished','hidden'].includes(sv)) importRow.status = 'draft' as any;
        }

        logger.debug('Entry type:', { entryType: importRow.entry_type });

        // Determine if this is a product row
        // Either explicitly marked as 'product' or has no entry_type but has required fields
        const isProductRow = importRow.entry_type === 'product' || (!importRow.entry_type && importRow.handle && importRow.title);
        
        logger.debug('Is product row:', { isProductRow });

        // Normalize entry_type case
        if (typeof importRow.entry_type === 'string') {
          const et = importRow.entry_type.trim().toLowerCase();
          if (et === 'product' || et === 'variant') {
            importRow.entry_type = et as any;
          } else if (et.length) {
            // Unrecognized entry_type; treat as empty so row can still qualify as product
            importRow.entry_type = '' as any;
          }
        }

        // Skip repeated header rows inside data (case-insensitive)
        if (importRow.handle && importRow.title && importRow.handle.toLowerCase() === 'handle' && importRow.title.toLowerCase() === 'title') {
          skipped++;
            results.errors.push({ row: i, field: 'skip', message: 'Skipped repeated header row' });
            continue;
        }
        if (isProductRow) {
          productRows++;
          logger.debug(`Processing as product: handle=${importRow.handle}, title=${importRow.title}`);
          
          // Validate required fields
          if (!importRow.handle || !importRow.title) {
            results.errors.push({
              row: i,
              field: 'required',
              message: `Missing required fields: handle or title`
            });
            logger.debug(`Skipping line ${i}: Missing handle or title`);
            continue;
          }
          // Create or update base product
          const imageUrls = importRow.image_urls ? importRow.image_urls.split(',').map((u: string) => u.trim()).filter(Boolean) : [];
          const normalizedImages = imageUrls; // store as array of URL strings
          // Sanitize HTML description
          let sanitizedDescription = importRow.description ? sanitizeHtml(importRow.description) : '';
          const rowWarnings: string[] = [];
          if (importRow.description && sanitizedDescription !== importRow.description) {
            rowWarnings.push('description sanitized');
          }
          // Optional truncation safeguard (e.g., if DB column has length limit)
          const MAX_DESC = 20000; // safe guard; adjust if needed
            if (sanitizedDescription && sanitizedDescription.length > MAX_DESC) {
              sanitizedDescription = sanitizedDescription.slice(0, MAX_DESC);
              rowWarnings.push('description truncated');
            }
          const initialVariantPrice = importRow.variant_price && !isNaN(parseFloat(String(importRow.variant_price))) ? parseFloat(String(importRow.variant_price)) : undefined;
          const derivedFirstVariantPrice = firstVariantPriceByHandle[importRow.handle];
          const productData: any = {
            handle: importRow.handle,
            title: importRow.title,
            description: sanitizedDescription,
            vendor: importRow.vendor,
            product_type: importRow.product_type,
            tags: importRow.tags ? importRow.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            status: (importRow.status as any) || 'active',
            image: imageUrls[0] || null,
            images: normalizedImages,
            created_by: user.id,
            updated_by: user.id,
            price: initialVariantPrice ?? derivedFirstVariantPrice ?? 0
          };

          // Always populate legacy 'name' (before column filtering) to satisfy NOT NULL schemas
          if (!productData.name) {
            productData.name = productData.title || productData.handle;
          }

          // Conditionally remove columns that do not exist in current schema
          const { columns: cols, meta: productColumnsMeta } = await ensureProductColumns(supabase);
          // Column presence adaptations
          if (!cols.has('created_by')) { delete productData.created_by; rowWarnings.push('created_by missing; omitted'); }
          if (!cols.has('updated_by')) { delete productData.updated_by; rowWarnings.push('updated_by missing; omitted'); }
          if (!cols.has('tags')) { delete productData.tags; rowWarnings.push('tags missing; omitted'); }
          if (!cols.has('image')) { delete productData.image; }
          if (!cols.has('images')) { delete productData.images; rowWarnings.push('images missing; omitted'); }
          if (!cols.has('description')) { delete productData.description; rowWarnings.push('description missing; omitted'); }
          if (!cols.has('name')) { /* keep name anyway; if it truly doesn't exist DB will ignore extra field */ } else { rowWarnings.push('name field included'); }
          // Mirror price into base_price if schema uses base_price instead or in addition
          if (!cols.has('price') && cols.has('base_price')) {
            productData.base_price = productData.price ?? 0;
            rowWarnings.push('using base_price (no price column)');
          } else if (cols.has('price') && cols.has('base_price')) {
            productData.base_price = productData.price ?? 0;
            rowWarnings.push('mirrored price to base_price');
          }
          // Price derivation BEFORE optional removals
          if (cols.has('price')) {
            const thisVariantPrice = importRow.variant_price ? parseFloat(String(importRow.variant_price)) : NaN;
            if (!isNaN(thisVariantPrice) && thisVariantPrice >= 0) {
              productData.price = thisVariantPrice; rowWarnings.push('price from same row variant');
            } else if (firstVariantPriceByHandle[productData.handle] !== undefined) {
              productData.price = firstVariantPriceByHandle[productData.handle]; rowWarnings.push('price derived from first variant');
            } else if (productData.price === undefined || productData.price === null) {
              productData.price = 0; rowWarnings.push('price defaulted to 0');
            }
          }
          // Absolute final safeguard for price / base_price non-null
          if (cols.has('price')) {
            if (productData.price === null || productData.price === undefined || isNaN(Number(productData.price))) {
              productData.price = 0;
              rowWarnings.push('price final safeguard applied');
            }
          }
          if (!cols.has('price') && cols.has('base_price')) {
            if (productData.base_price === null || productData.base_price === undefined || isNaN(Number(productData.base_price))) {
              productData.base_price = 0;
              rowWarnings.push('base_price final safeguard applied');
            }
          }
          if (cols.has('compare_at_price') && (productData.compare_at_price === undefined)) {
            productData.compare_at_price = null;
          }
            if (cols.has('cost_per_item') && (productData.cost_per_item === undefined)) {
              productData.cost_per_item = 0;
            }
          if (cols.has('inventory_quantity') && (productData.inventory_quantity === undefined)) {
            productData.inventory_quantity = 0;
          }
          if (cols.has('weight') && (productData.weight === undefined)) {
            productData.weight = 0;
          }
          // If title column missing but name exists, we already handled above; if both exist keep both.
          // If both title & name exist and name not set, optionally mirror (skip to avoid unintended overwrites)

          // Decide conflict target if handle missing
          const conflictColumn = cols.has('handle') ? 'handle' : (cols.has('title') ? 'title' : (cols.has('name') ? 'name' : undefined));

          // Column metadata aware safeguarding (in case DB enforces NOT NULL differently)
          const priceMeta = (productColumnsMeta || {})['price'];
          if (priceMeta && !priceMeta.nullable && (productData.price === undefined || productData.price === null)) {
            productData.price = 0; rowWarnings.push('price meta-enforced safeguard');
          }
          const basePriceMeta = (productColumnsMeta || {})['base_price'];
          if (basePriceMeta && !basePriceMeta.nullable && (productData.base_price === undefined || productData.base_price === null)) {
            productData.base_price = productData.price ?? 0; rowWarnings.push('base_price meta-enforced safeguard');
          }
          logger.debug('import_product_upsert_payload', { handle: productData.handle, price: productData.price, base_price: productData.base_price, priceType: typeof productData.price, keys: Object.keys(productData), warnings: rowWarnings, schemaColumns: Array.from(cols) });
          if (!debugFirstProductPayload) debugFirstProductPayload = { ...productData };

          let product: any = null;
          let upsertError: any = null;
          // Attempt primary upsert
          let attempt;
          if (conflictColumn) {
            attempt = await supabase
              .from('products')
              .upsert(productData, { onConflict: conflictColumn as any })
              .select()
              .single();
          } else {
            attempt = await supabase
              .from('products')
              .upsert(productData)
              .select()
              .single();
          }
          if (!attempt.error) {
            product = attempt.data;
          } else {
            upsertError = attempt.error;
            logger.warn('Primary upsert failed, attempting fallback', { handle: productData.handle, code: attempt.error.code, message: attempt.error.message, details: attempt.error.details, hint: attempt.error.hint, priceValue: productData.price, priceType: typeof productData.price, base_price: productData.base_price });
            if (!debugFirstProductError) debugFirstProductError = { code: attempt.error.code, message: attempt.error.message, details: attempt.error.details, hint: attempt.error.hint };
            // If the failure mentions price null, force inject price/base_price then retry once before progressive fallbacks
            if ((attempt.error.message || '').toLowerCase().includes('null value in column "price"')) {
              if (cols.has('price')) {
                productData.price = productData.price ?? 0;
              }
              if (!cols.has('price') && cols.has('base_price')) {
                productData.base_price = productData.base_price ?? 0;
              }
              const retryPrice = conflictColumn
                ? await supabase.from('products').upsert(productData, { onConflict: conflictColumn as any }).select().single()
                : await supabase.from('products').upsert(productData).select().single();
              if (!retryPrice.error) {
                product = retryPrice.data;
                upsertError = null;
              } else {
                upsertError = retryPrice.error; // continue to fallbacks
              }
            }
            // Fallback: progressively remove optional fields that commonly mismatch types
            productFallbacks++;
            const optionalFieldGroups: string[][] = [
              ['images','image'],
              ['tags'],
              ['vendor','product_type'],
              ['description']
            ]; // keep price in all fallbacks
            const mutablePayload: any = { ...productData };
            for (const group of optionalFieldGroups) {
              for (const k of group) delete mutablePayload[k];
              // ensure name persists for NOT NULL constraint
              if (!mutablePayload.name) mutablePayload.name = productData.name;
              const retry = conflictColumn
                ? await supabase.from('products').upsert(mutablePayload, { onConflict: conflictColumn as any }).select().single()
                : await supabase.from('products').upsert(mutablePayload).select().single();
              if (!retry.error) { product = retry.data; upsertError = null; break; }
              else { upsertError = retry.error; }
            }
            if (!product && upsertError) {
              // Final minimalist attempt with only handle/title/status
              const minimal: any = { handle: productData.handle, title: productData.title, status: productData.status || 'active' };
              if (cols.has('price')) minimal.price = 0;
              if (!minimal.name) minimal.name = minimal.title || minimal.handle; // ensure name for final attempt
              const finalTry = conflictColumn
                ? await supabase.from('products').upsert(minimal, { onConflict: conflictColumn as any }).select().single()
                : await supabase.from('products').upsert(minimal).select().single();
              if (!finalTry.error) { product = finalTry.data; upsertError = null; }
              else { upsertError = finalTry.error; }
            }
          }

          if (upsertError) {
            productFinalFailures++;
            logger.error('Product creation failed after fallbacks', { handle: importRow.handle, code: upsertError.code, message: upsertError.message, priceValue: productData.price, base_price: productData.base_price });
            results.errors.push({
              row: i,
              field: 'product',
              message: `Failed to create product ${importRow.handle}: ${upsertError.message}`
            });
            continue;
          }

          logger.info('Created product:', { id: product.id, handle: product.handle, title: product.title, name: (product as any).name });
          if (rowWarnings.length) {
            results.errors.push({ row: i, field: 'warning', message: rowWarnings.join('; ') });
          }

          // If variant fields are present, create a variant too
          if (importRow.variant_sku || importRow.variant_price) {
            const variantData = {
              product_id: product.id,
              title: importRow.variant_title || 'Default',
              sku: importRow.variant_sku,
              barcode: importRow.variant_barcode,
              price: parseFloat(importRow.variant_price?.toString() || '0'),
              compare_at_price: importRow.variant_compare_price ? parseFloat(importRow.variant_compare_price.toString()) : null,
              cost_per_item: importRow.variant_cost ? parseFloat(importRow.variant_cost.toString()) : null,
              weight: importRow.variant_weight ? parseFloat(importRow.variant_weight.toString()) : null,
              inventory_quantity: parseInt(importRow.variant_inventory?.toString() || '0'),
              option1: importRow.option1_value,
              option2: importRow.option2_value,
              option3: importRow.option3_value,
              status: 'active'
            };

            logger.debug('Creating variant with data:', { variantData });

            const { error: variantError } = await supabase
              .from('product_variants')
              .insert(variantData);

            if (variantError) {
              logger.error('Variant creation error:', { error: variantError });
              results.errors.push({
                row: i,
                field: 'variant',
                message: `Failed to create variant: ${variantError.message}`
              });
            }
          }

          // Create options if specified
          if (importRow.option1_name) {
            const options = [];
            if (importRow.option1_name) {
              options.push({
                product_id: product.id,
                name: importRow.option1_name,
                values: [], // Will be populated by variants
                position: 1
              });
            }
            if (importRow.option2_name) {
              options.push({
                product_id: product.id,
                name: importRow.option2_name,
                values: [],
                position: 2
              });
            }
            if (importRow.option3_name) {
              options.push({
                product_id: product.id,
                name: importRow.option3_name,
                values: [],
                position: 3
              });
            }

            // Delete existing options
            await supabase
              .from('product_options')
              .delete()
              .eq('product_id', product.id);

            // Insert new options
            for (const option of options) {
              const { error: optionError } = await supabase
                .from('product_options')
                .insert(option);
              
              if (optionError) {
                logger.error('Error creating option:', { error: optionError });
              }
            }
          }

          results.created_products.push(product.handle);
          results.success++;

  } else if (importRow.entry_type === 'variant') {
          variantRows++;
          logger.debug(`Processing as variant: handle=${importRow.handle}, variant_title=${importRow.variant_title}`);
          
          // Find the product by handle
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id')
            .eq('handle', importRow.handle)
            .single();

          if (productError || !product) {
            logger.error(`Product with handle ${importRow.handle} not found for variant:`, { error: productError });
            results.errors.push({
              row: i,
              field: 'handle',
              message: `Product with handle ${importRow.handle} not found for variant`
            });
            continue;
          }

          logger.debug(`Found product for variant: ${product.id}`);

          // Create variant
          const variantData = {
            product_id: product.id,
            title: importRow.variant_title,
            sku: importRow.variant_sku,
            barcode: importRow.variant_barcode,
            price: parseFloat(importRow.variant_price?.toString() || '0'),
            compare_at_price: importRow.variant_compare_price ? parseFloat(importRow.variant_compare_price.toString()) : null,
            cost_per_item: importRow.variant_cost ? parseFloat(importRow.variant_cost.toString()) : null,
            weight: importRow.variant_weight ? parseFloat(importRow.variant_weight.toString()) : null,
            inventory_quantity: parseInt(importRow.variant_inventory?.toString() || '0'),
            option1: importRow.option1_value,
            option2: importRow.option2_value,
            option3: importRow.option3_value,
            status: 'active'
          };

          const { error: variantError } = await supabase
            .from('product_variants')
            .insert(variantData);

          if (variantError) {
            results.errors.push({
              row: i,
              field: 'variant',
              message: `Failed to create variant: ${variantError.message}`
            });
            continue;
          }

          // Track option values to update later
          if (!productOptions[product.id]) {
            productOptions[product.id] = {};
          }
          
          if (importRow.option1_name && importRow.option1_value) {
            if (!productOptions[product.id][importRow.option1_name]) {
              productOptions[product.id][importRow.option1_name] = new Set();
            }
            productOptions[product.id][importRow.option1_name].add(importRow.option1_value);
          }
          
          if (importRow.option2_name && importRow.option2_value) {
            if (!productOptions[product.id][importRow.option2_name]) {
              productOptions[product.id][importRow.option2_name] = new Set();
            }
            productOptions[product.id][importRow.option2_name].add(importRow.option2_value);
          }
          
          if (importRow.option3_name && importRow.option3_value) {
            if (!productOptions[product.id][importRow.option3_name]) {
              productOptions[product.id][importRow.option3_name] = new Set();
            }
            productOptions[product.id][importRow.option3_name].add(importRow.option3_value);
          }

          results.success++;
        } else {
          skipped++;
          results.errors.push({
            row: i,
            field: 'skip',
            message: `Skipped: entry_type='${importRow.entry_type || ''}' handle='${importRow.handle || ''}' title='${importRow.title || ''}'`
          });
        }

      } catch (rowError) {
        results.errors.push({
          row: i,
          field: 'general',
          message: rowError instanceof Error ? rowError.message : 'Unknown error'
        });
      }
    }

    // Update option values based on variants
    for (const [productId, options] of Object.entries(productOptions)) {
      for (const [optionName, valuesSet] of Object.entries(options)) {
        const values = Array.from(valuesSet);
        
        await supabase
          .from('product_options')
          .update({ values })
          .eq('product_id', productId)
          .eq('name', optionName);
      }
    }

  logger.info('Final results:', { results });
    
    // Add helpful message if no items were processed
    let message = `Import completed. ${results.success} items processed.`;
    if (results.success === 0 && results.errors.length === 0) {
      message += ' No valid product rows found. Make sure your CSV has "handle" and "title" columns with data.';
    }
    if (skipped > 0) {
      message += ` ${skipped} line(s) skipped.`;
    }

  // Include product table columns (if cached) for debugging handle presence
  const { columns: cols, meta: productColumnsMeta } = await ensureProductColumns(supabase);
  return NextResponse.json({
      success: true,
      message,
      results,
      debug: {
        totalLines: lines.length,
        headers,
        firstLineData: lines.length > 1 ? parseCSVLine(lines[1]) : null,
        productRows,
        variantRows,
        productFallbacks,
    productFinalFailures,
    productTableColumns: Array.from(cols),
    productColumnsMeta,
    firstProductPayload: debugFirstProductPayload,
    firstProductError: debugFirstProductError
      }
    });
  } catch (error) {
    logger.error('Import API error:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
