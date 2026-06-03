/**
 * AI HTML Description Generator (Enhanced)
 * POST /api/ai/generate-description
 *
 * Replaces the plain-text version with a fully-styled HTML output using:
 *  - Crimson Maroon accent (#d9534f) for section headers
 *  - Bold <ul> feature lists
 *  - Green summary card <div class="summary"> at the bottom
 *  - All string literals use double single-quotes (''text'') to survive
 *    SQL string termination in raw INSERT contexts.
 *
 * Auth:  manager role or above.
 * Cache: Redis (24h) keyed by SHA-256 of the input payload.
 */

import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateGeminiText } from '@/lib/ai/gemini-service';
import { requireRole } from '@/lib/auth/guard';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';

// ─────────────────────────────────────────────────────────────────────────────
// Input schema
// ─────────────────────────────────────────────────────────────────────────────

const requestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().optional().default('General'),
  brand: z.string().optional(),
  model_number: z.string().optional(),
  /** Bullet-point hints to guide the AI about what features to highlight */
  feature_hints: z.array(z.string()).optional(),
  /** HSN code for GST note injection into the summary card */
  hsn_code: z.string().optional(),
  /** Override the accent color; defaults to Crimson Maroon */
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#d9534f'),
});

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(input: z.infer<typeof requestSchema>): string {
  const { title, category, brand, model_number, feature_hints, hsn_code, accent_color } = input;

  const featureBlock = feature_hints && feature_hints.length > 0
    ? `\nKey features to cover:\n${feature_hints.map((f: string) => `  - ${f}`).join('\n')}`
    : '';

  const hsnNote = hsn_code
    ? `HSN Code: ${hsn_code} (include in the summary card as a GST reference note)`
    : '';

  return `You are an expert Indian e-commerce product copywriter specialising in IT hardware and electronics.

PRODUCT DETAILS:
  Title:        ${title}
  Category:     ${category}
  Brand:        ${brand || 'N/A'}
  Model Number: ${model_number || 'N/A'}
  ${featureBlock}
  ${hsnNote}

TASK:
Generate a beautifully styled product description as a self-contained HTML fragment (NO <html>, <head>, or <body> tags).

STRICT FORMATTING RULES — follow exactly, no deviation:

1. HEADER SECTION:
   <h2 style="color: ${accent_color}; font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 1.4rem; margin-bottom: 0.5rem; border-bottom: 2px solid ${accent_color}; padding-bottom: 0.4rem;">
     [Product Title Here]
   </h2>

2. INTRO PARAGRAPH:
   <p style="font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 0.95rem; line-height: 1.7; color: #333; margin-bottom: 1rem;">
     [2-3 sentence punchy overview of what the product does and who it is for]
   </p>

3. FEATURES SECTION (REQUIRED – use exactly this structure):
   <h3 style="color: ${accent_color}; font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 1.1rem; margin-bottom: 0.5rem;">
     Key Features
   </h3>
   <ul style="font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 0.9rem; line-height: 1.8; color: #444; padding-left: 1.2rem; margin-bottom: 1.2rem;">
     <li><strong>[Feature label]:</strong> [Feature detail]</li>
     <!-- Minimum 5 feature bullets, maximum 8 -->
   </ul>

4. APPLICATIONS / USE CASES (optional but preferred):
   <h3 style="color: ${accent_color}; font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 1.1rem; margin-bottom: 0.5rem;">
     Ideal Applications
   </h3>
   <ul style="font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 0.9rem; line-height: 1.8; color: #444; padding-left: 1.2rem; margin-bottom: 1.2rem;">
     <li>[Use case 1]</li>
     <li>[Use case 2]</li>
   </ul>

5. SUMMARY CARD (REQUIRED – place at the bottom):
   <div class="summary" style="background: linear-gradient(135deg, #e8f5e9, #f1f8e9); border-left: 4px solid #28a745; border-radius: 6px; padding: 1rem 1.2rem; margin-top: 1.2rem; font-family: ''Inter'', ''Segoe UI'', sans-serif;">
     <strong style="color: #28a745; font-size: 1rem;">✅ Why Choose This Product?</strong>
     <p style="font-size: 0.88rem; color: #2e7d32; margin-top: 0.4rem; line-height: 1.6;">
       [2-sentence compelling closing pitch]
     </p>
     ${hsn_code ? `<p style="font-size: 0.78rem; color: #555; margin-top: 0.5rem;">📋 <em>GST Reference – HSN Code: ${hsn_code} | Applicable GST rate may vary. Consult your tax advisor.</em></p>` : ''}
   </div>

SQL-SAFETY RULE — CRITICAL:
All apostrophes in text MUST be escaped as double single-quotes (example: doesn''t, India''s, it''s).
This prevents SQL string termination failures in raw INSERT statements.
Never use a single apostrophe inside any text string in the output.

OUTPUT: Return ONLY the HTML fragment. No markdown, no fences, no preamble.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-processor: strip any accidental markdown the model emits
// ─────────────────────────────────────────────────────────────────────────────

function sanitiseHtmlOutput(raw: string): string {
  return raw
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth guard ────────────────────────────────────────────────────────
    const authCheck = await requireRole('manager');
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    // ── 2. Validate input ────────────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: validation.error.format() },
        { status: 400 }
      );
    }

    const input = validation.data;

    // ── 3. Cache lookup ──────────────────────────────────────────────────────
    const cacheKey = `ai:html-desc:${crypto
      .createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex')}`;

    const redis = getRedis();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('ai_generate_html_desc.cache_hit', { cacheKey });
          return NextResponse.json(JSON.parse(cached));
        }
      } catch {
        // Non-fatal: proceed without cache
      }
    }

    // ── 4. Call Gemini ───────────────────────────────────────────────────────
    const prompt = buildSystemPrompt(input);

    const rawHtml = await generateGeminiText({
      prompt,
      temperature: 0.55,      // Balanced creativity vs consistency
      maxOutputTokens: 2048,  // Enough for a rich HTML block
    });

    const description = sanitiseHtmlOutput(rawHtml);

    // ── 5. Basic validation: must contain expected structural markers ─────────
    const hasHeader = description.includes('<h2') || description.includes('<h3');
    const hasFeatureList = description.includes('<ul');
    const hasSummaryCard = description.includes('class="summary"') || description.includes("class='summary'");

    const warnings: string[] = [];
    if (!hasHeader)      warnings.push('Output missing <h2>/<h3> header – review prompt compliance');
    if (!hasFeatureList) warnings.push('Output missing <ul> feature list – review prompt compliance');
    if (!hasSummaryCard) warnings.push('Output missing .summary card – review prompt compliance');

    // ── 6. Cache write ───────────────────────────────────────────────────────
    const responseData = {
      description,
      metadata: {
        title: input.title,
        category: input.category,
        brand: input.brand,
        model_number: input.model_number,
        accent_color: input.accent_color,
        sql_safe: true, // apostrophes escaped as double single-quotes
      },
      warnings: warnings.length ? warnings : undefined,
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 86400);
      } catch {
        // Non-fatal
      }
    }

    logger.info('ai_generate_html_desc.success', {
      title: input.title,
      descLength: description.length,
      warnings,
    });

    return NextResponse.json(responseData);
  } catch (error: any) {
    logger.error('ai_generate_html_desc.unexpected_error', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to generate HTML product description', details: error.message },
      { status: 500 }
    );
  }
}
