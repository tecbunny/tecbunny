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
import { getSystemPrompt } from '@/lib/ai/prompts';

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

async function buildSystemPrompt(input: z.infer<typeof requestSchema>): Promise<string> {
  const { title, category, brand, model_number, feature_hints, hsn_code, accent_color } = input;

  const featureBlock = feature_hints && feature_hints.length > 0
    ? `\nKey features to cover:\n${feature_hints.map((f: string) => `  - ${f}`).join('\n')}`
    : '';

  const hsnNote = hsn_code
    ? `HSN Code: ${hsn_code} (include in the summary card as a GST reference note)`
    : '';

  const hsnSummaryNote = hsn_code
    ? `<p style="font-size: 0.78rem; color: #555; margin-top: 0.5rem;">📋 <em>GST Reference – HSN Code: ${hsn_code} | Applicable GST rate may vary. Consult your tax advisor.</em></p>`
    : '';

  const systemPrompt = await getSystemPrompt('generate_description');
  return systemPrompt
    .replace(/{title}/g, title)
    .replace(/{category}/g, category)
    .replace(/{brand}/g, brand || 'N/A')
    .replace(/{model_number}/g, model_number || 'N/A')
    .replace(/{featureBlock}/g, featureBlock)
    .replace(/{hsnNote}/g, hsnNote)
    .replace(/{accent_color}/g, accent_color || '#d9534f')
    .replace(/{hsnSummaryNote}/g, hsnSummaryNote);
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
    const prompt = await buildSystemPrompt(input);

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
