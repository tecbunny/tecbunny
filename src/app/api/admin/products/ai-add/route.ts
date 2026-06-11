/**
 * AI-Powered Product Ingestion Pool
 * POST /api/admin/products/ai-add
 *
 * Parses unstructured supplier text, raw model tokens (e.g. CP-UNC-DA21L3C-LQ-0360),
 * or base64-encoded product images into clean, constraint-safe DB inserts using Gemini.
 *
 * Fallback defaults are enforced for every NOT NULL column so no constraint violation
 * can ever surface from the AI output path.
 */

import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';


import { logger } from '@/lib/logger';
import { createServiceClient, isSupabaseServiceConfigured, createClient } from '@/lib/supabase/server';
import { getSessionWithRole } from '@/lib/auth/server-role';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { TaxClassificationError } from '@/lib/ai/tax-classification';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(['admin', 'manager', 'superadmin']);
const HANDLE_MAX = 60;

function getUuidAuditUserId(userId: string | undefined): string | null {
  if (!userId || userId === 'superadmin-root-id') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null;
}

/** Fallback values that satisfy every known NOT NULL constraint on public.products */
const NOT_NULL_DEFAULTS: Record<string, unknown> = {
  status: 'active',
  category: 'General',          // NOT NULL – most critical fallback
  product_type: 'General',
  title: 'Unnamed Product',
  name: 'Unnamed Product',
  price: 0,
  popularity: 0,
  rating: 0,
};

function taxErrorResponse(error: unknown, correlationId: string) {
  if (error instanceof TaxClassificationError) {
    return NextResponse.json(
      { error: error.message, correlationId },
      { status: error.statusCode, headers: { 'x-correlation-id': correlationId } }
    );
  }

  logger.error('ai_product_ingestion.tax_classification_unhandled', { correlationId, error });
  return NextResponse.json(
    { error: 'Tax classification failed', correlationId },
    { status: 502, headers: { 'x-correlation-id': correlationId } }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini system prompt for supplier text → product JSON
// ─────────────────────────────────────────────────────────────────────────────

async function buildIngestionPrompt(rawInput: string, imageBase64?: string): Promise<string> {
  const imageNote = imageBase64
    ? `\nAn image of the product has also been provided (base64 encoded). Use it to infer visual attributes (color, form factor, connector type, etc.).\n`
    : '';

  const systemPrompt = await getSystemPrompt('ai_add');
  return systemPrompt
    .replace('{imageNote}', imageNote)
    .replace('{rawInput}', rawInput);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug helper
// ─────────────────────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, HANDLE_MAX);
}

// ─────────────────────────────────────────────────────────────────────────────
// Enforce NOT NULL fallbacks so no constraint violation can surface
// ─────────────────────────────────────────────────────────────────────────────

function applyConstraintDefaults(
  parsed: Record<string, unknown>,
  dbColumns: Set<string> | null
): Record<string, unknown> {
  const safe: Record<string, unknown> = { ...parsed };

  for (const [col, defaultVal] of Object.entries(NOT_NULL_DEFAULTS)) {
    // Only apply when the column actually exists in the live schema
    if (dbColumns && !dbColumns.has(col)) continue;
    if (safe[col] === undefined || safe[col] === null || safe[col] === '') {
      safe[col] = defaultVal;
    }
  }

  // Ensure numeric fields are real numbers
  for (const numField of ['price', 'mrp', 'stock_quantity', 'gst_rate', 'popularity', 'rating']) {
    if (safe[numField] !== undefined) {
      const parsed = Number(safe[numField]);
      safe[numField] = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  // Ensure tags is a real array
  if (safe.tags !== undefined && !Array.isArray(safe.tags)) {
    safe.tags = typeof safe.tags === 'string'
      ? safe.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];
  }

  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unique handle generator (mirrors products/route.ts logic)
// ─────────────────────────────────────────────────────────────────────────────

async function ensureUniqueHandle(supabase: any, candidate: string): Promise<string> {
  const trimmed = candidate.slice(0, HANDLE_MAX);
  let attempt = 0;
  let next = trimmed;

  while (attempt < 20) {
    const { data } = await supabase
      .from('products')
      .select('id')
      .eq('handle', next)
      .limit(1);

    if (!data || data.length === 0) return next;
    attempt++;
    const suffix = attempt < 10 ? `0${attempt}` : String(attempt);
    next = `${trimmed}-${suffix}`.slice(0, HANDLE_MAX);
  }

  return `${trimmed}-${crypto.randomUUID().slice(0, 6)}`.slice(0, HANDLE_MAX);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch live column set to filter payload keys safely
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProductColumns(supabase: any): Promise<Set<string> | null> {
  try {
    const { data, error } = await supabase
      .from('information_schema.columns' as any)
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'products');

    if (error || !data) return null;
    return new Set<string>(data.map((r: any) => String(r.column_name)));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Strip payload keys that don't exist in the DB schema
// ─────────────────────────────────────────────────────────────────────────────

function stripUnknownColumns(
  payload: Record<string, unknown>,
  dbColumns: Set<string> | null
): { clean: Record<string, unknown>; stripped: string[] } {
  if (!dbColumns) return { clean: payload, stripped: [] };

  const clean: Record<string, unknown> = {};
  const stripped: string[] = [];

  for (const [k, v] of Object.entries(payload)) {
    if (dbColumns.has(k)) {
      clean[k] = v;
    } else {
      stripped.push(k);
    }
  }

  return { clean, stripped };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const { supabase: authClient, session, role } = await getSessionWithRole(request);

    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!role || !ADMIN_ROLES.has(role)) {
      return NextResponse.json({ error: 'Forbidden – admin or manager role required' }, { status: 403 });
    }

    const supabase = isSupabaseServiceConfigured ? createServiceClient() : authClient ?? await createClient();
    const auditUserId = getUuidAuditUserId(session.user.id);

    // ── 2. Parse request ─────────────────────────────────────────────────────
    let rawText: string = '';
    let imageBase64: string | undefined;
    let dryRun = false;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      rawText = (form.get('text') as string) || '';
      dryRun = form.get('dry_run') === 'true';

      const imageFile = form.get('image') as File | null;
      if (imageFile) {
        const buf = await imageFile.arrayBuffer();
        imageBase64 = Buffer.from(buf).toString('base64');
      }
    } else {
      const body = await request.json().catch(() => ({}));
      rawText = body.text || body.model_token || body.supplier_text || '';
      imageBase64 = body.image_base64;
      dryRun = body.dry_run === true;
    }

    if (!rawText && !imageBase64) {
      return NextResponse.json(
        { error: 'Provide either `text` (supplier text / model token) or `image_base64`' },
        { status: 400, headers: { 'x-correlation-id': correlationId } }
      );
    }

    logger.info('ai_product_ingestion.start', { correlationId, textLength: rawText.length, hasImage: !!imageBase64 });

    // ── 3. Gemini extraction ─────────────────────────────────────────────────
    const prompt = await buildIngestionPrompt(rawText, imageBase64);

    let aiRawOutput: string;
    try {
      const { generateGeminiText } = await import('@/lib/ai/gemini-service');
      aiRawOutput = await generateGeminiText({
        prompt,
        temperature: 0.2,     // Low temperature for deterministic extraction
        maxOutputTokens: 1024,
      });
    } catch (geminiErr: any) {
      logger.error('ai_product_ingestion.gemini_failed', { correlationId, error: geminiErr.message });
      return NextResponse.json(
        { error: 'AI extraction failed', details: geminiErr.message },
        { status: 502, headers: { 'x-correlation-id': correlationId } }
      );
    }

    // ── 4. Parse JSON output from Gemini ─────────────────────────────────────
    let parsed: Record<string, unknown>;
    try {
      // Strip any accidental markdown fences Gemini may still include
      const cleaned = aiRawOutput
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      logger.warn('ai_product_ingestion.json_parse_failed', { correlationId, raw: aiRawOutput.slice(0, 300) });
      return NextResponse.json(
        {
          error: 'AI returned non-JSON output. Raw text attached.',
          ai_raw: aiRawOutput.slice(0, 500),
        },
        { status: 422, headers: { 'x-correlation-id': correlationId } }
      );
    }

    logger.debug('ai_product_ingestion.parsed', { correlationId, keys: Object.keys(parsed) });

    // ── 5. Fetch live DB columns ─────────────────────────────────────────────
    const dbColumns = await fetchProductColumns(supabase);

    // ── 6. Enforce NOT NULL constraint defaults ───────────────────────────────
    const withDefaults = applyConstraintDefaults(parsed as Record<string, unknown>, dbColumns);

    // ── 7. Build and finalise handle ─────────────────────────────────────────
    const rawHandle = withDefaults.handle
      ? slugify(String(withDefaults.handle))
      : slugify(String(withDefaults.title || withDefaults.name || 'product'));

    const prefixedHandle = rawHandle.startsWith('id-') ? rawHandle : `id-${rawHandle}`;
    const uniqueHandle = await ensureUniqueHandle(supabase, prefixedHandle);

    const payload: Record<string, unknown> = {
      ...withDefaults,
      handle: uniqueHandle,
      created_by: auditUserId,
      updated_by: auditUserId,
    };

    // ── 8. Strip any AI hallucinated columns not in the live schema ───────────
    try {
      const { classifyProductTax } = await import('@/lib/ai/tax-classification');
      const taxClassification = await classifyProductTax({
        title: payload.title ?? payload.name,
        description: payload.description,
        category: payload.category,
        productType: payload.product_type,
        targetIndustry: payload.target_industry ?? payload.industry,
        brand: payload.brand ?? payload.vendor,
        modelNumber: payload.model_number,
        specifications: payload.specifications,
      }, correlationId);
      payload.hsn_code = taxClassification.hsn_code;
      payload.gst_rate = taxClassification.gst_rate;
      payload.tax_ai_confidence = taxClassification.confidence_score;
      payload.tax_ai_justification = taxClassification.justification;
      payload.tax_ai_model = 'gemini-2.5-flash-lite';
      payload.tax_ai_classified_at = new Date().toISOString();
      if (auditUserId) {
        payload.tax_ai_requested_by = auditUserId;
      }
      payload.tax_ai_reviewed = false;
      payload.tax_ai_reviewed_by = null;
      payload.tax_ai_reviewed_at = null;
    } catch (error) {
      return taxErrorResponse(error, correlationId);
    }

    const { clean: finalPayload, stripped: strippedCols } = stripUnknownColumns(payload, dbColumns);

    if (strippedCols.length) {
      logger.warn('ai_product_ingestion.columns_stripped', { correlationId, stripped: strippedCols });
    }

    // ── 9. Dry-run mode – return payload without inserting ────────────────────
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        parsed_product: finalPayload,
        stripped_columns: strippedCols,
        correlationId,
      });
    }

    // ── 10. Insert into DB ───────────────────────────────────────────────────
    const { data: inserted, error: insertError } = await supabase
      .from('products')
      .insert(finalPayload)
      .select()
      .single();

    if (insertError) {
      logger.error('ai_product_ingestion.insert_failed', {
        correlationId,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });

      return NextResponse.json(
        {
          error: 'Database insert failed',
          db_error: {
            code: insertError.code,
            message: insertError.message,
            hint: insertError.hint,
          },
          // Return the payload that was attempted so the caller can correct it
          attempted_payload_keys: Object.keys(finalPayload),
          correlationId,
        },
        { status: 500, headers: { 'x-correlation-id': correlationId } }
      );
    }

    logger.info('ai_product_ingestion.success', { correlationId, productId: inserted?.id });

    return NextResponse.json(
      {
        success: true,
        message: 'Product ingested and created successfully via AI',
        data: inserted,
        ai_metadata: {
          model: 'gemini-2.5-flash-lite',
          stripped_columns: strippedCols.length ? strippedCols : undefined,
        },
        correlationId,
      },
      { headers: { 'x-correlation-id': correlationId } }
    );
  } catch (err: any) {
    logger.error('ai_product_ingestion.unhandled', { correlationId, error: err.message, stack: err.stack });
    return NextResponse.json(
      { error: 'Internal server error', correlationId },
      { status: 500, headers: { 'x-correlation-id': correlationId } }
    );
  }
}
