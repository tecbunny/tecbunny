import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { getSessionWithRole } from '@/lib/auth/server-role';
import { logger } from '@/lib/logger';
import { getProductDisplayImage } from '@/lib/image-utils';
import { filterPubliclyVisibleProducts, isPubliclyVisibleProduct } from '@/lib/product-visibility';
import { classifyProductTax, TaxClassificationError, type ProductTaxClassification } from '@/lib/ai/tax-classification';

const HANDLE_MAX_LENGTH = 60;
const PUBLIC_PRODUCTS_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=900';
const PUBLIC_PRODUCT_COLUMNS = [
  'id',
  'handle',
  'slug',
  'permalink',
  'title',
  'name',
  'description',
  'body_html',
  'details',
  'vendor',
  'brand',
  'brand_logo',
  'product_type',
  'category',
  'collection',
  'images',
  'image',
  'gallery',
  'seo_title',
  'meta_title',
  'seo_description',
  'meta_description',
  'hsn_code',
  'hsncode',
  'hsn',
  'hsn_sac',
  'gst_rate',
  'gst_percentage',
  'tax_ai_confidence',
  'tax_ai_justification',
  'tax_ai_classified_at',
  'mrp',
  'maximum_retail_price',
  'list_price',
  'price',
  'selling_price',
  'unit_price',
  'offer_price',
  'discount_percentage',
  'discount_source',
  'has_active_discount',
  'applied_offer_title',
  'stock_status',
  'stock_quantity',
  'min_stock_level',
  'max_stock_level',
  'model_number',
  'product_url',
  'rating',
  'reviewCount',
  'review_count',
  'prioritized',
  'prioritized_at',
  'status',
  'tags',
  'created_at',
  'updated_at',
].join(',');

const COLUMN_ALIASES: Record<string, string[]> = {
  handle: ['handle', 'slug', 'permalink'],
  title: ['title', 'name'],
  description: ['description', 'body_html', 'details'],
  vendor: ['vendor', 'brand'],
  product_type: ['product_type', 'category', 'collection'],
  category: ['category', 'product_type', 'collection'],
  images: ['images', 'image', 'gallery'],
  seo_title: ['seo_title', 'meta_title'],
  seo_description: ['seo_description', 'meta_description'],
  hsnCode: ['hsn_code', 'hsncode'],
  gstRate: ['gst_rate', 'gst_percentage'],
  product_url: ['product_url'],
  mrp: ['mrp', 'maximum_retail_price', 'list_price'],
  price: ['price', 'selling_price', 'unit_price'],
};

function slugifyInput(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, HANDLE_MAX_LENGTH);
}

function normalizeProductRecord(product: any) {
  if (!product || typeof product !== 'object') {
    return product;
  }

  // Resolve product image from all possible fields (image, images, additional_images, etc.)
  product.image = getProductDisplayImage(product) || product.image || null;

  const rawHsn =
    product.hsnCode ??
    product.hsn_code ??
    product.hsn ??
    product.hsn_sac ??
    null;
  if (rawHsn != null) {
    const normalized = typeof rawHsn === 'string' ? rawHsn.trim() : rawHsn;
    if (normalized && typeof normalized === 'string') {
      product.hsnCode = normalized;
    }
  }

  const rawGst =
    product.gstRate ??
    product.gst_rate ??
    product.gst_percentage ??
    null;
  if (rawGst != null) {
    if (typeof rawGst === 'number' && Number.isFinite(rawGst)) {
      product.gstRate = rawGst;
    } else if (typeof rawGst === 'string') {
      const parsed = Number.parseFloat(rawGst);
      if (Number.isFinite(parsed)) {
        product.gstRate = parsed;
      }
    }
  }

  return product;
}

function isSupabaseConnectivityError(error: unknown): boolean {
  const message = String((error as any)?.message || '').toLowerCase();
  const details = String((error as any)?.details || '').toLowerCase();
  const combined = `${message} ${details}`;

  return [
    'fetch failed',
    'enotfound',
    'eai_again',
    'getaddrinfo',
    'network',
    'timed out',
    'econnrefused',
    'econnreset',
  ].some((token) => combined.includes(token));
}

function buildCatalogFallback(page: number, limit: number) {
  return {
    success: true,
    data: [],
    pagination: {
      page,
      limit,
      total: 0,
      pages: 0,
    },
    warnings: ['Product service is temporarily unreachable. Check Supabase DNS/network connectivity.'],
  };
}

function jsonWithCache(body: unknown, cacheControl: string, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', cacheControl);
  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

function resolveColumnName(columns: Set<string> | null, key: string): string | undefined {
  const candidates = COLUMN_ALIASES[key];
  if (!columns) {
    // Default to first alias so updates still proceed when metadata is unavailable
    if (candidates && candidates.length > 0) {
      return candidates[0];
    }
    return key;
  }
  if (!candidates) {
    return columns.has(key) ? key : undefined;
  }
  const match = candidates.find(column => columns.has(column));
  return match ?? undefined;
}

function buildPublicProductSelect(columns: Set<string> | null) {
  if (!columns) {
    return '*';
  }

  const requestedColumns = PUBLIC_PRODUCT_COLUMNS
    .split(',')
    .filter((column) => columns.has(column));

  return requestedColumns.length > 0 ? requestedColumns.join(',') : '*';
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 1), max);
}

function cleanSearchText(value: string | null | undefined, maxLength = 80) {
  if (!value) {
    return '';
  }
  return value
    .trim()
    .replace(/[%_*]/g, '')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function pickFirst(...values: unknown[]) {
  return values.find((value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== undefined && value !== null;
  });
}

function stripUnknownPayloadColumns(
  payload: Record<string, any>,
  columns: Set<string> | null,
  warnings: string[]
) {
  if (!columns) return;

  for (const key of Object.keys(payload)) {
    if (!columns.has(key)) {
      delete payload[key];
      warnings.push(`${key} column missing; ignored`);
    }
  }
}

function applyTaxClassificationToPayload(
  payload: Record<string, any>,
  classification: ProductTaxClassification,
  userId: string | null
) {
  payload.hsnCode = classification.hsn_code;
  payload.gstRate = classification.gst_rate;
  payload.tax_ai_confidence = classification.confidence_score;
  payload.tax_ai_justification = classification.justification;
  payload.tax_ai_model = 'gemini-2.5-flash-lite';
  payload.tax_ai_classified_at = new Date().toISOString();
  payload.tax_ai_reviewed = false;
  payload.tax_ai_reviewed_by = null;
  payload.tax_ai_reviewed_at = null;
  if (userId) {
    payload.tax_ai_requested_by = userId;
  }
}

function getUuidAuditUserId(userId: string | undefined): string | null {
  if (!userId || userId === 'superadmin-root-id') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null;
}

function taxErrorResponse(error: unknown, correlationId?: string) {
  if (error instanceof TaxClassificationError) {
    return NextResponse.json(
      { error: error.message, correlationId },
      { status: error.statusCode }
    );
  }

  logger.error('products.tax_classification_unhandled', { correlationId, error });
  return NextResponse.json(
    { error: 'Tax classification failed', correlationId },
    { status: 502 }
  );
}

async function ensureProductColumns(supabase: any): Promise<Set<string> | null> {
  try {
    const adminClient = isSupabaseServiceConfigured ? createServiceClient() : supabase;

    // 1. Try querying the public view products_columns_view
    const { data: viewData, error: viewError } = await adminClient
      .from('products_columns_view')
      .select('column_name');

    if (!viewError && viewData && viewData.length > 0) {
      const columns = new Set<string>(viewData.map((c: any) => String(c.column_name)));
      logger.debug('product_columns_fetched_from_view', { columns: Array.from(columns) });
      return columns;
    }

    // 2. Try querying a single row directly to extract columns from keys
    const { data: rowData, error: rowError } = await adminClient
      .from('products')
      .select('*')
      .limit(1);

    if (!rowError && rowData && rowData.length > 0) {
      const columns = new Set<string>(Object.keys(rowData[0]));
      logger.debug('product_columns_fetched_from_row', { columns: Array.from(columns) });
      return columns;
    }

    // 3. Fallback to direct information_schema query
    const { data, error } = await adminClient
      .from('information_schema.columns' as any)
      .select('column_name,table_schema')
      .eq('table_name', 'products')
      .eq('table_schema', 'public');

    if (!error && data && data.length > 0) {
      const columns = new Set<string>(data.map((c: any) => String(c.column_name)));
      logger.debug('product_columns_fetched_from_schema', { columns: Array.from(columns) });
      return columns;
    }

    logger.warn('product_columns_fetch_all_failed', {
      viewError: viewError?.message,
      rowError: rowError?.message,
      schemaError: error?.message,
    });
    return null;
  } catch (e) {
    logger.warn('product_columns_fetch_exception', { error: (e as Error).message });
    return null;
  }
}

const ADMIN_ROLES = new Set(['admin', 'manager', 'superadmin']);

// Get products with variants and options
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = cleanSearchText(searchParams.get('handle'), HANDLE_MAX_LENGTH);
    const include_variants = searchParams.get('include_variants') === 'true';
    const include_options = searchParams.get('include_options') === 'true';

    const { supabase: authClient, role } = await getSessionWithRole(request);
    const isPrivilegedRequest = Boolean(role && ADMIN_ROLES.has(role));
    const supabase = role && ADMIN_ROLES.has(role) && isSupabaseServiceConfigured
      ? createServiceClient()
      : authClient ?? await createClient();
    const productColumns = await ensureProductColumns(supabase);
    const publicProductSelect = buildPublicProductSelect(productColumns);

    if (handle) {
      // Get specific product by handle (use name as fallback)
      let product: any = null;
      try {
        let query = supabase
          .from('products')
          .select(publicProductSelect)
          .limit(1);

        if (!productColumns || productColumns.has('handle')) {
          query = query.eq('handle', handle);
        } else if (productColumns.has('slug')) {
          query = query.eq('slug', handle);
        } else if (productColumns.has('permalink')) {
          query = query.eq('permalink', handle);
        } else if (productColumns.has('title')) {
          query = query.ilike('title', `%${handle}%`);
        } else if (productColumns.has('name')) {
          query = query.ilike('name', `%${handle}%`);
        } else if (productColumns.has('description')) {
          query = query.ilike('description', `%${handle}%`);
        }

        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        product = data;
  } catch (_error: any) {
        // Fallback: check which columns exist and try appropriate fallback
        let fallbackQuery = supabase.from('products').select(publicProductSelect);
        
        if (productColumns?.has('title')) {
          fallbackQuery = fallbackQuery.ilike('title', `%${handle}%`);
        } else if (productColumns?.has('name')) {
          fallbackQuery = fallbackQuery.ilike('name', `%${handle}%`);
        } else {
          // Last resort: search by description
          fallbackQuery = fallbackQuery.ilike('description', `%${handle}%`);
        }
        
        const { data: list } = await fallbackQuery.limit(1);
        if (!list || list.length === 0) {
          return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }
        product = list[0];
      }

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      if (!isPrivilegedRequest && !isPubliclyVisibleProduct(product)) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      // Get variants if requested (skip if table doesn't exist)
      if (include_variants) {
        try {
          const { data: variants } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', product.id)
            .order('position');
          
          product.variants = variants || [];
        } catch (_error) {
          logger.info('products.variants_table_not_available', { productId: product.id });
          product.variants = [];
        }
      }

      // Get options if requested (skip if table doesn't exist)
      if (include_options) {
        try {
          const { data: options } = await supabase
            .from('product_options')
            .select('*')
            .eq('product_id', product.id)
            .order('position');
          
          product.options = options || [];
        } catch (_error) {
          logger.info('products.options_table_not_available', { productId: product.id });
          product.options = [];
        }
      }

      return jsonWithCache({
        success: true,
        data: normalizeProductRecord(product)
      }, PUBLIC_PRODUCTS_CACHE_CONTROL);
  } else {
      // Get all products with pagination
      const page = parsePositiveInt(searchParams.get('page'), 1, 10_000);
      const limit = parsePositiveInt(searchParams.get('limit'), 20, 100);
      const offset = (page - 1) * limit;

      // Get sort parameter (default to created_at for newest first)
      const sortBy = searchParams.get('sort') || 'created_at';
      const sortOrder = searchParams.get('order') || 'desc'; // Changed to 'desc' so newest products appear first

      let query: any = supabase
        .from('products')
        .select(publicProductSelect, { count: 'estimated' })
        .range(offset, offset + limit - 1);

      // Apply sorting with prioritized products first
      // Always sort by prioritized status first (prioritized products at top)
      if (productColumns && productColumns.has('prioritized')) {
        query = query.order('prioritized', { ascending: false, nullsFirst: false });
      }

      // Then sort prioritized products by prioritized_at (most recently prioritized first)
      if (productColumns && productColumns.has('prioritized_at')) {
        query = query.order('prioritized_at', { ascending: false, nullsFirst: false });
      }

      // Finally apply the requested sort for non-prioritized products and as tertiary sort
      if ((sortBy === 'title' || sortBy === 'name') && (!productColumns || productColumns.has(sortBy))) {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      } else if (sortBy === 'price' && (!productColumns || productColumns.has('price'))) {
        query = query.order('price', { ascending: sortOrder === 'asc' });
      } else if (sortBy === 'display_order' && productColumns && productColumns.has('display_order')) {
        query = query.order('display_order', { ascending: sortOrder === 'asc', nullsFirst: false })
                     .order('created_at', { ascending: false });
      } else {
        // Default to created_at (newest first when desc)
        query = query.order('created_at', { ascending: sortOrder === 'asc' });
      }

      // Apply visibility filters at the database level for non-privileged requests
      if (!isPrivilegedRequest) {
        if (!productColumns || productColumns.has('status')) {
          query = query.eq('status', 'active');
        }
        if (!productColumns || productColumns.has('is_active')) {
          query = query.eq('is_active', true);
        }
        if (!productColumns || productColumns.has('is_deleted')) {
          query = query.eq('is_deleted', false);
        }
        if (!productColumns || productColumns.has('price')) {
          query = query.gt('price', 0);
        }
      } else {
        const status = searchParams.get('status');
        if (status) {
          query = query.eq('status', status);
        }
      }

      const vendor = searchParams.get('vendor');
      if (vendor && (!productColumns || productColumns.has('vendor'))) {
        query = query.eq('vendor', vendor);
      }

      const search = cleanSearchText(searchParams.get('search'));
      if (search) {
        // Check which columns exist and use appropriate search
        if (!productColumns || productColumns.has('title')) {
          query = query.ilike('title', `%${search}%`);
        } else if (productColumns.has('name')) {
          query = query.ilike('name', `%${search}%`);
        } else if (productColumns.has('description')) {
          query = query.ilike('description', `%${search}%`);
        }
      }

      const { data: rawProducts, error, count } = await query;
      const products = Array.isArray(rawProducts) ? (rawProducts as any[]) : [];

      if (error) {
        if (isSupabaseConnectivityError(error)) {
          logger.warn('products.fetch_failed_connectivity_fallback', { error });
          return jsonWithCache(buildCatalogFallback(page, limit), PUBLIC_PRODUCTS_CACHE_CONTROL);
        }
        logger.error('products.fetch_failed', { error });
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
      }
      // Optionally load options / variants in bulk if requested
      const warnings: string[] = [];
      if (products.length) {
        const productIds = products.map(p => p.id).filter(Boolean);
        if (include_options && productIds.length) {
          try {
            const { data: opts } = await supabase
              .from('product_options')
              .select('*')
              .in('product_id', productIds)
              .order('position');
            if (opts) {
              const grouped: Record<string, any[]> = {};
              opts.forEach(o => {
                (grouped[o.product_id] = grouped[o.product_id] || []).push(o);
              });
              products.forEach(p => { (p as any).options = grouped[p.id] || []; });
            }
          } catch (_error: any) {
            warnings.push('product_options table missing; options skipped');
          }
        }
        if (include_variants && productIds.length) {
          try {
            const { data: vars } = await supabase
              .from('product_variants')
              .select('*')
              .in('product_id', productIds)
              .order('position');
            if (vars) {
              const grouped: Record<string, any[]> = {};
              vars.forEach(v => {
                (grouped[v.product_id] = grouped[v.product_id] || []).push(v);
              });
              products.forEach(p => { (p as any).variants = grouped[p.id] || []; });
            }
          } catch (_error: any) {
            warnings.push('product_variants table missing; variants skipped');
          }
        }
      }

      const visibleProducts = isPrivilegedRequest ? products : filterPubliclyVisibleProducts(products);

      return jsonWithCache({
        success: true,
        data: visibleProducts.map(normalizeProductRecord),
        pagination: {
          page,
          limit,
          total: isPrivilegedRequest ? count || 0 : visibleProducts.length,
          pages: Math.ceil((isPrivilegedRequest ? count || 0 : visibleProducts.length) / limit)
        },
        warnings: warnings.length ? warnings : undefined
      }, PUBLIC_PRODUCTS_CACHE_CONTROL);
    }
  } catch (error) {
    const { searchParams } = new URL(request.url);
    const hasHandleLookup = Boolean(searchParams.get('handle'));
    if (!hasHandleLookup && isSupabaseConnectivityError(error)) {
      logger.warn('products.api_connectivity_fallback', { error });
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parsePositiveInt(searchParams.get('limit'), 20, 100);
      return jsonWithCache(buildCatalogFallback(page, limit), PUBLIC_PRODUCTS_CACHE_CONTROL);
    }

    logger.error('products.api_error', { error });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create or update product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const debugMode = request.nextUrl.searchParams.get('debug') === '1';
    const summariseError = (err: unknown) => {
      if (!err || typeof err !== 'object') {
        return undefined;
      }
      const record = err as Record<string, unknown>;
      return {
        message: record.message,
        code: record.code,
        details: record.details,
        hint: record.hint,
      };
    };
    const { 
      handle, 
      name,
      title, 
      description, 
      vendor, 
      brand,
      product_type, 
      category,
      target_industry,
      industry,
      industryType,
      tags, 
      status, 
      images, 
      image,
      additional_images,
      seo_title, 
      seo_description,
      options,
      variants,
      mrp,
      price,
      product_url,
      hsnCode,
      gstRate,
      specifications,
      model_number,
      stock_quantity,
      min_stock_level,
      max_stock_level,
      stock_status,
    } = body;

    // Normalize images to an array of URL strings (supports legacy object shape {url})
    const normalizedImages = [
      ...(Array.isArray(images)
        ? images.map((img: any) => typeof img === 'string' ? img : img?.url).filter(Boolean)
        : []),
      ...(typeof image === 'string' && image.trim() ? [image.trim()] : []),
      ...(Array.isArray(additional_images)
        ? additional_images.map((img: any) => typeof img === 'string' ? img : img?.url).filter(Boolean)
        : []),
    ];

    const { supabase: authClient, session, role } = await getSessionWithRole(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!role || !ADMIN_ROLES.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Media validation gatekeeper check
    if ((status === 'active' || status === 'published') && normalizedImages.length === 0) {
      return NextResponse.json(
        { error: 'Product cannot be published without at least one valid image upload reference.' },
        { status: 422 }
      );
    }

    const supabase = role && ADMIN_ROLES.has(role) && isSupabaseServiceConfigured
      ? createServiceClient()
      : authClient;
    const user = session.user;
    const auditUserId = getUuidAuditUserId(user.id);

    // Create product; now that handle is available, prefer upsert on handle (or closest alias), with safe fallback
    let product: any = null;
    const normalizedTitleSource = pickFirst(title, name);
    const normalizedTitle = typeof normalizedTitleSource === 'string' && normalizedTitleSource.trim() ? normalizedTitleSource.trim() : undefined;
    const normalizedHandle = typeof handle === 'string' && handle.trim() ? handle.trim() : undefined;
    const normalizedProductType = typeof product_type === 'string' && product_type.trim() ? product_type.trim() : undefined;
    const normalizedCategory = typeof category === 'string' && category.trim() ? category.trim() : undefined;
    const resolvedCategory = normalizedCategory ?? normalizedProductType ?? 'General';
    const slugFromTitle = normalizedTitle ? slugifyInput(normalizedTitle) : '';
    const slugFromHandle = normalizedHandle ? slugifyInput(normalizedHandle) : '';
    const baseHandleSegment = slugFromHandle || slugFromTitle || `product-${crypto.randomUUID().slice(0, 8)}`;
    const derivedHandle = (baseHandleSegment.startsWith('id-') ? baseHandleSegment : `id-${baseHandleSegment}`).slice(0, HANDLE_MAX_LENGTH);

    const basePayload: Record<string, any> = {
      handle: derivedHandle,
      title: normalizedTitle,
      description,
      vendor: pickFirst(vendor, brand),
      product_type: normalizedProductType,
      category: resolvedCategory,
      tags,
      status: status || 'active',
      images: normalizedImages,
      image: normalizedImages[0],
      additional_images: normalizedImages.slice(1),
      seo_title,
      seo_description,
      product_url,
      specifications,
      model_number,
      created_by: auditUserId,
      updated_by: auditUserId,
    };

    if (mrp !== undefined) {
      basePayload.mrp = mrp;
    }
    if (price !== undefined) {
      basePayload.price = price;
    }
    if (stock_quantity !== undefined) {
      const qty = Number(stock_quantity);
      basePayload.stock_quantity = Number.isFinite(qty) && qty > 0 ? qty : 0;
    }
    if (min_stock_level !== undefined) {
      const minStock = Number(min_stock_level);
      basePayload.min_stock_level = Number.isFinite(minStock) && minStock > 0 ? minStock : 0;
    }
    if (max_stock_level !== undefined) {
      const maxStock = Number(max_stock_level);
      basePayload.max_stock_level = Number.isFinite(maxStock) && maxStock > 0 ? maxStock : 0;
    }
    if (typeof stock_status === 'string') {
      basePayload.stock_status = stock_status;
    }
    if (hsnCode !== undefined) {
      basePayload.hsnCode = hsnCode;
    }
    if (gstRate !== undefined) {
      basePayload.gstRate = gstRate;
    }

    Object.keys(basePayload).forEach((key) => {
      if (basePayload[key] === undefined) {
        delete basePayload[key];
      }
    });

    const cols = await ensureProductColumns(supabase);
    const postWarnings: string[] = [];
    const columnSet = cols ?? null;
    if (!cols) {
      postWarnings.push('product schema metadata unavailable; attempted insert without column validation');
    }

    try {
      const taxClassification = await classifyProductTax({
        title: normalizedTitle,
        description,
        category: resolvedCategory,
        productType: normalizedProductType,
        targetIndustry: pickFirst(target_industry, industry, industryType),
        brand: pickFirst(brand, vendor),
        modelNumber: model_number,
        specifications,
      }, request.headers.get('x-correlation-id') || undefined);
      applyTaxClassificationToPayload(basePayload, taxClassification, auditUserId);
    } catch (error) {
      return taxErrorResponse(error, request.headers.get('x-correlation-id') || undefined);
    }

    const applyAlias = (inputKey: string, warningKey?: string) => {
      if (!Object.prototype.hasOwnProperty.call(basePayload, inputKey)) {
        return;
      }
      const value = basePayload[inputKey];
      const targetColumn = resolveColumnName(columnSet, inputKey);
      if (!targetColumn) {
        delete basePayload[inputKey];
        if (cols) {
          postWarnings.push(`${warningKey ?? inputKey} column missing; ${inputKey} ignored`);
        }
        return;
      }
      if (targetColumn !== inputKey) {
        basePayload[targetColumn] = value;
        delete basePayload[inputKey];
      }
    };

    ['handle', 'title', 'description', 'vendor', 'product_type', 'category', 'images', 'seo_title', 'seo_description', 'mrp', 'price', 'product_url'].forEach((key) => applyAlias(key));
    applyAlias('hsnCode', 'hsn_code');
    applyAlias('gstRate', 'gst_rate');

    if (cols) {
      if (Object.prototype.hasOwnProperty.call(basePayload, 'tags') && !cols.has('tags')) {
        delete basePayload.tags;
        postWarnings.push('tags column missing; tags ignored');
      }
      if (Object.prototype.hasOwnProperty.call(basePayload, 'created_by') && !cols.has('created_by')) {
        delete basePayload.created_by;
        postWarnings.push('created_by column missing; ignored');
      }
      if (Object.prototype.hasOwnProperty.call(basePayload, 'updated_by') && !cols.has('updated_by')) {
        delete basePayload.updated_by;
        postWarnings.push('updated_by column missing; ignored');
      }
      if (Object.prototype.hasOwnProperty.call(basePayload, 'stock_quantity') && !cols.has('stock_quantity')) {
        delete basePayload.stock_quantity;
        postWarnings.push('stock_quantity column missing; stock quantity ignored');
      }
      if (Object.prototype.hasOwnProperty.call(basePayload, 'min_stock_level') && !cols.has('min_stock_level')) {
        delete basePayload.min_stock_level;
        postWarnings.push('min_stock_level column missing; min stock ignored');
      }
      if (Object.prototype.hasOwnProperty.call(basePayload, 'max_stock_level') && !cols.has('max_stock_level')) {
        delete basePayload.max_stock_level;
        postWarnings.push('max_stock_level column missing; max stock ignored');
      }
      if (Object.prototype.hasOwnProperty.call(basePayload, 'stock_status') && !cols.has('stock_status')) {
        delete basePayload.stock_status;
        postWarnings.push('stock_status column missing; stock status ignored');
      }
      if (Object.prototype.hasOwnProperty.call(basePayload, 'category') && !cols.has('category')) {
        delete basePayload.category;
        postWarnings.push('category column missing; category ignored');
      }
      if (Object.prototype.hasOwnProperty.call(basePayload, 'product_type') && !cols.has('product_type')) {
        delete basePayload.product_type;
        postWarnings.push('product_type column missing; product type ignored');
      }
      stripUnknownPayloadColumns(basePayload, cols, postWarnings);
    }

    const handleColumn = resolveColumnName(columnSet, 'handle');
    const normalizedHandleKey = handleColumn && Object.prototype.hasOwnProperty.call(basePayload, handleColumn)
      ? handleColumn
      : undefined;

    const ensureUniqueHandle = async (candidate: string): Promise<string> => {
      if (!handleColumn || !candidate) {
        return candidate;
      }
      const trimmed = candidate.slice(0, HANDLE_MAX_LENGTH);
      let attempt = 0;
      let nextCandidate = trimmed;
      while (attempt < 20) {
        const { data, error } = await supabase
          .from('products')
          .select('id')
          .eq(handleColumn, nextCandidate)
          .limit(1);
        if (error) {
          logger.warn('products.handle_uniqueness_check_failed', { error: error.message, handleColumn, candidate: nextCandidate });
          return nextCandidate;
        }
        if (!data || data.length === 0) {
          return nextCandidate;
        }
        attempt += 1;
        const suffix = attempt < 10 ? `0${attempt}` : String(attempt);
        nextCandidate = `${trimmed}-${suffix}`.slice(0, HANDLE_MAX_LENGTH);
      }
      return `${trimmed}-${crypto.randomUUID().slice(0, 6)}`.slice(0, HANDLE_MAX_LENGTH);
    };

    let hasHandleValue = false;
    if (normalizedHandleKey) {
      const desiredHandle = String(basePayload[normalizedHandleKey] ?? '').trim();
      if (desiredHandle) {
        basePayload[normalizedHandleKey] = await ensureUniqueHandle(desiredHandle);
        hasHandleValue = true;
      } else {
        delete basePayload[normalizedHandleKey];
      }
    }

    let upsertResult: { data: any; error: any } = { data: null, error: null };
    let upsertError: any = null;
    if (hasHandleValue && handleColumn) {
      upsertResult = await supabase
        .from('products')
        .upsert(basePayload, { onConflict: handleColumn })
        .select()
        .single();
      if (!upsertResult.error && upsertResult.data) {
        product = upsertResult.data;
      } else if (upsertResult.error) {
        upsertError = upsertResult.error;
      }
    }

    if (!product) {
      const fallbackPayload = { ...basePayload };
      const insertResult = await supabase
        .from('products')
        .insert(fallbackPayload)
        .select()
        .single();
      if (insertResult.error) {
        logger.error('products.create_failed', { upsertError, insertError: insertResult.error });
        const insertSummary = summariseError(insertResult.error);
        const errorBody = debugMode
          ? {
              error: 'Failed to create product',
              supabase: {
                ...insertSummary,
                upsertError: summariseError(upsertError),
              },
              payloadKeys: Object.keys(basePayload),
            }
          : { error: 'Failed to create product' };
        return NextResponse.json(errorBody, { status: 500 });
      }
      product = insertResult.data;
    }

    if (!product) {
      logger.error('products.create_no_product_returned', { upsertError, basePayloadKeys: Object.keys(basePayload) });
      const errorBody = debugMode
        ? {
            error: 'Failed to create product',
            supabase: { upsertError: summariseError(upsertError), fallback: 'No product returned' },
            payloadKeys: Object.keys(basePayload),
          }
        : { error: 'Failed to create product' };
      return NextResponse.json(errorBody, { status: 500 });
    }

    // Create options if provided
    if (options && options.length > 0) {
      // Delete existing options
      await supabase
        .from('product_options')
        .delete()
        .eq('product_id', product.id);

      // Insert new options
      const optionsData = options.map((option: any, index: number) => ({
        product_id: product.id,
        name: option.name,
        values: option.values,
        position: index + 1
      }));

      const { error: optionsError } = await supabase
        .from('product_options')
        .insert(optionsData);

      if (optionsError) {
        logger.error('products.create_options_failed', { error: optionsError });
      }
    }

    // Create variants if provided
    if (variants && variants.length > 0) {
      // Delete existing variants
      await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', product.id);

      // Insert new variants
      const variantsData = variants.map((variant: any, index: number) => ({
        product_id: product.id,
        title: variant.title,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price || 0,
        compare_at_price: variant.compare_at_price,
        cost_per_item: variant.cost_per_item,
        weight: variant.weight,
        inventory_quantity: variant.inventory_quantity || 0,
        option1: variant.option1,
        option2: variant.option2,
        option3: variant.option3,
        position: index + 1,
        status: 'active'
      }));

      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantsData);

      if (variantsError) {
        logger.error('products.create_variants_failed', { error: variantsError });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Product created successfully',
      data: product,
      warnings: postWarnings.length ? postWarnings : undefined
    });

  } catch (error) {
    logger.error('products.create_api_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update product
export async function PUT(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();
  try {
    const body = await request.json();
    const { id, options, variants, handle: _ignoreHandle, images, image, additional_images, ...updateData } = body;

    if (!id) {
      logger.warn('product_update_missing_id', { correlationId });
      return NextResponse.json({ error: 'Product id is required' }, { status: 400, headers: { 'x-correlation-id': correlationId } });
    }

    // Handle image fields from frontend
    if (image !== undefined) {
      (updateData as any).image = image;
    }
    if (additional_images !== undefined) {
      (updateData as any).additional_images = additional_images;
    }

    // Normalize images if passed (array of URLs or objects) - legacy support
    if (Array.isArray(images)) {
      const normalizedImages = images.map((img: any) => typeof img === 'string' ? img : img?.url).filter(Boolean);
      (updateData as any).images = normalizedImages;
      logger.info('product_update_images', { 
        correlationId, 
        receivedCount: images.length, 
        normalizedCount: normalizedImages.length,
        firstImage: normalizedImages[0] || 'none'
      });
    }

    const { supabase: authClient, session, role } = await getSessionWithRole(request);
    if (!session) {
      logger.warn('product_update_unauthenticated', { correlationId });
      return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: { 'x-correlation-id': correlationId } });
    }
    if (!role || !ADMIN_ROLES.has(role)) {
      logger.warn('product_update_forbidden', { correlationId, role });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'x-correlation-id': correlationId } });
    }

    const supabase = role && ADMIN_ROLES.has(role) && isSupabaseServiceConfigured
      ? createServiceClient()
      : authClient;
    const user = session.user;
    const auditUserId = getUuidAuditUserId(user.id);

    const { data: existingProduct, error: existingProductError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existingProductError) {
      logger.error('product_update_existing_fetch_failed', { correlationId, id, error: existingProductError.message });
      return NextResponse.json({ error: 'Failed to load existing product', correlationId }, { status: 500, headers: { 'x-correlation-id': correlationId } });
    }

    if (!existingProduct) {
      logger.warn('product_update_existing_not_found', { correlationId, id });
      return NextResponse.json({ error: 'Product not found', correlationId }, { status: 404, headers: { 'x-correlation-id': correlationId } });
    }

    // Media validation gatekeeper check
    const targetStatus = updateData.status;
    if (targetStatus === 'active' || targetStatus === 'published') {
      const hasImagesPayload = Array.isArray(images);
      let activeImagesCount = 0;
      if (hasImagesPayload) {
        const normalizedImages = images.map((img: any) => typeof img === 'string' ? img : img?.url).filter(Boolean);
        activeImagesCount = normalizedImages.length;
      } else {
        activeImagesCount = Array.isArray(existingProduct?.images) ? existingProduct.images.length : 0;
      }

      if (activeImagesCount === 0) {
        logger.warn('product_update_publish_blocked_no_images', { productId: id, correlationId });
        return NextResponse.json(
          { error: 'Product cannot be published without at least one valid image upload reference.' },
          { status: 422, headers: { 'x-correlation-id': correlationId } }
        );
      }
    }

    // Normalize tags if provided as comma separated string
    if (typeof (updateData as any).tags === 'string') {
      (updateData as any).tags = (updateData as any).tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);
    }
    const updateCols = await ensureProductColumns(supabase);
    const putWarnings: string[] = [];
    if (!updateCols) {
      putWarnings.push('product schema metadata unavailable; attempted update without column validation');
    } else if (!updateCols.has('tags')) {
      delete (updateData as any).tags;
      putWarnings.push('tags column missing; tags ignored');
    }

    const numericStockFields: Array<{ key: 'stock_quantity' | 'min_stock_level' | 'max_stock_level'; warning: string }> = [
      { key: 'stock_quantity', warning: 'stock_quantity column missing; stock quantity ignored' },
      { key: 'min_stock_level', warning: 'min_stock_level column missing; min stock ignored' },
      { key: 'max_stock_level', warning: 'max_stock_level column missing; max stock ignored' },
    ];

    numericStockFields.forEach(({ key, warning }) => {
      if (Object.prototype.hasOwnProperty.call(updateData, key)) {
        const numericValue = Number((updateData as any)[key]);
        (updateData as any)[key] = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
        if (updateCols && !updateCols.has(key)) {
          delete (updateData as any)[key];
          putWarnings.push(warning);
        }
      }
    });

    if (Object.prototype.hasOwnProperty.call(updateData, 'stock_status')) {
      if (typeof (updateData as any).stock_status !== 'string') {
        delete (updateData as any).stock_status;
      } else if (updateCols && !updateCols.has('stock_status')) {
        delete (updateData as any).stock_status;
        putWarnings.push('stock_status column missing; stock status ignored');
      }
    }

    const mergedProductForTax = { ...existingProduct, ...updateData };
    try {
      const taxClassification = await classifyProductTax({
        title: pickFirst(mergedProductForTax.title, mergedProductForTax.name),
        description: mergedProductForTax.description,
        category: mergedProductForTax.category,
        productType: mergedProductForTax.product_type,
        targetIndustry: pickFirst(
          mergedProductForTax.target_industry,
          mergedProductForTax.industry,
          mergedProductForTax.industryType
        ),
        brand: pickFirst(mergedProductForTax.brand, mergedProductForTax.vendor),
        modelNumber: mergedProductForTax.model_number,
        specifications: mergedProductForTax.specifications,
      }, correlationId);
      applyTaxClassificationToPayload(updateData as Record<string, any>, taxClassification, auditUserId);
    } catch (error) {
      return taxErrorResponse(error, correlationId);
    }

    const updateColumns = updateCols ? new Set<string>(updateCols) : null;
    Object.keys(COLUMN_ALIASES).forEach((inputKey) => {
      if (Object.prototype.hasOwnProperty.call(updateData, inputKey)) {
        const value = (updateData as any)[inputKey];
        const targetColumn = resolveColumnName(updateColumns, inputKey);
        if (targetColumn) {
          (updateData as any)[targetColumn] = value;
          if (targetColumn !== inputKey) {
            delete (updateData as any)[inputKey];
          }
        } else if (updateColumns) {
          const aliases = COLUMN_ALIASES[inputKey];
          putWarnings.push(`${aliases[0]} column missing; ${inputKey} ignored`);
          delete (updateData as any)[inputKey];
        }
      }
    });

    // Remove undefined keys to avoid PostgREST rejecting explicit undefined
    Object.keys(updateData).forEach(k => (updateData as any)[k] === undefined && delete (updateData as any)[k]);

    stripUnknownPayloadColumns(updateData as Record<string, any>, updateColumns, putWarnings);

  logger.debug('product_update_payload', { correlationId, id, keys: Object.keys(updateData), imagesCount: (updateData as any).images?.length, tagsType: typeof (updateData as any).tags });

  const updateFields: any = { ...updateData };
  if (auditUserId && (!updateCols || updateCols.has('updated_by'))) updateFields.updated_by = auditUserId;
  if (!updateCols || updateCols.has('updated_at')) updateFields.updated_at = new Date().toISOString();

    const { data: product, error } = await supabase
      .from('products')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('product_update_failed', { correlationId, code: (error as any).code, message: error.message, details: error.details });
      const debug = request.nextUrl.searchParams.get('debug') === '1';
      let schema: any = undefined;
      if (debug) {
        try {
          const { data: columns } = await supabase
            .from('information_schema.columns' as any)
            .select('column_name,data_type,is_nullable')
            .eq('table_name', 'products');
          schema = columns?.filter((c: any) => ['images','tags','title','handle','status'].includes(c.column_name));
        } catch (e) {
          schema = { error: (e as Error).message };
        }
      }
      return NextResponse.json({ 
        error: 'Failed to update product', 
        error_code: (error as any).code || undefined,
        hint: (!process.env.NODE_ENV || process.env.NODE_ENV === 'development' || debug) ? error.message : undefined,
        schema,
        correlationId
      }, { status: 500, headers: { 'x-correlation-id': correlationId } });
    }

    // Update options if provided
    if (Array.isArray(options)) {
      try {
        await supabase.from('product_options').delete().eq('product_id', id);
        if (options.length > 0) {
          const optionsData = options.map((option: any, index: number) => ({
            product_id: id,
            name: option.name,
            values: option.values,
            position: index + 1,
          }));
          const { error: optionsError } = await supabase
            .from('product_options')
            .insert(optionsData);
          if (optionsError) {
            logger.error('products.update_options_failed', { error: optionsError });
          }
        }
      } catch (e) {
        logger.info('products.options_update_table_missing', { productId: id, error: e });
      }
    }

    // Update variants if provided
    if (Array.isArray(variants)) {
      try {
        await supabase.from('product_variants').delete().eq('product_id', id);
        if (variants.length > 0) {
          const variantsData = variants.map((variant: any, index: number) => ({
            product_id: id,
            title: variant.title,
            sku: variant.sku,
            barcode: variant.barcode,
            price: variant.price || 0,
            compare_at_price: variant.compare_at_price,
            cost_per_item: variant.cost_per_item,
            weight: variant.weight,
            inventory_quantity: variant.inventory_quantity || 0,
            option1: variant.option1,
            option2: variant.option2,
            option3: variant.option3,
            position: index + 1,
            status: variant.status || 'active',
          }));
          const { error: variantsError } = await supabase
            .from('product_variants')
            .insert(variantsData);
          if (variantsError) {
            logger.error('products.update_variants_failed', { error: variantsError });
          }
        }
      } catch (e) {
        logger.info('products.variants_update_table_missing', { productId: id, error: e });
      }
    }

    logger.info('product_update_success', { correlationId, id, warnings: putWarnings });
    return NextResponse.json({
      success: true,
      message: 'Product updated successfully',
      data: product,
      correlationId,
      warnings: putWarnings.length ? putWarnings : undefined
    }, { headers: { 'x-correlation-id': correlationId } });

  } catch (error) {
    logger.error('product_update_unhandled', { correlationId, err: (error as Error).message, stack: (error as Error).stack });
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500, headers: { 'x-correlation-id': correlationId } });
  }
}

// Delete product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const { supabase: authClient, session, role } = await getSessionWithRole(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!role || !ADMIN_ROLES.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = role && ADMIN_ROLES.has(role) && isSupabaseServiceConfigured
      ? createServiceClient()
      : authClient ?? await createClient();

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('products.delete_failed', { error });
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    logger.error('products.delete_api_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
