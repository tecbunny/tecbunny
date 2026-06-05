import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { generateGeminiText } from '@/lib/ai/gemini-service';
import { requireRole } from '@/lib/auth/guard';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { getSystemPrompt } from '@/lib/ai/prompts';

const requestSchema = z.object({
  productUrl: z.string().url(),
  existingData: z.object({
    title: z.string().optional(),
    vendor: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    productType: z.string().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
    price: z.number().nullable().optional(),
    mrp: z.number().nullable().optional(),
    hsnCode: z.string().optional(),
    gstRate: z.string().optional(),
    warranty: z.string().optional(),
    modelNumber: z.string().optional(),
    barcode: z.string().optional(),
    installationApplicable: z.boolean().optional(),
    installationCharge: z.number().nullable().optional(),
  }).optional(),
});

const aiDetailsSchema = z.object({
  title: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  productType: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  mrp: z.number().nullable().optional(),
  hsnCode: z.string().nullable().optional(),
  gstRate: z.string().nullable().optional(),
  warranty: z.string().nullable().optional(),
  modelNumber: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  specifications: z.record(z.string(), z.string()).nullable().optional(),
  installationApplicable: z.boolean().nullable().optional(),
  installationCharge: z.number().nullable().optional(),
  handleSuggestion: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  productUrl: z.string().nullable().optional(),
});

const FETCH_TIMEOUT_MS = 15000;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeWhitespace(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(match[1]) : undefined;
}

function extractMetaContent(html: string, attribute: 'name' | 'property', key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(
    new RegExp(
      `<meta[^>]+${attribute}=["']${escapedKey}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>|<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attribute}=["']${escapedKey}["'][^>]*>`,
      'i'
    )
  );

  return match ? normalizeWhitespace(match[1] || match[2] || '') : undefined;
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

async function fetchPageContext(productUrl: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TecBunnyProductBot/1.0; +https://tecbunny.com)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product page (${response.status})`);
    }

    const html = await response.text();
    const bodyText = truncate(stripHtml(html), 12000) || '';
    const title = extractTitle(html);
    const description = extractMetaContent(html, 'name', 'description')
      || extractMetaContent(html, 'property', 'og:description')
      || extractMetaContent(html, 'name', 'twitter:description');
    const imageUrl = extractMetaContent(html, 'property', 'og:image')
      || extractMetaContent(html, 'name', 'twitter:image');
    const ogTitle = extractMetaContent(html, 'property', 'og:title');

    return {
      title,
      ogTitle,
      description,
      imageUrl,
      bodyText,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Timed out while fetching the product page');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJsonObject(raw: string): string {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : raw.trim();
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('AI response did not contain valid JSON');
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function sanitizeDetails(details: z.infer<typeof aiDetailsSchema>, fallbackImageUrl?: string, productUrl?: string) {
  const sanitizeString = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };

  const sanitizeNumber = (value: number | null | undefined) => {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
  };

  const tags = Array.isArray(details.tags)
    ? Array.from(new Set(details.tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12)
    : undefined;

  const specifications = details.specifications
    ? Object.fromEntries(
        Object.entries(details.specifications)
          .map(([key, value]) => [key.trim(), value.trim()])
          .filter(([key, value]) => key && value)
      )
    : undefined;

  return {
    title: sanitizeString(details.title),
    vendor: sanitizeString(details.vendor),
    brand: sanitizeString(details.brand),
    category: sanitizeString(details.category),
    productType: sanitizeString(details.productType),
    tags,
    description: sanitizeString(details.description),
    price: sanitizeNumber(details.price),
    mrp: sanitizeNumber(details.mrp),
    hsnCode: sanitizeString(details.hsnCode),
    gstRate: sanitizeString(details.gstRate),
    warranty: sanitizeString(details.warranty),
    modelNumber: sanitizeString(details.modelNumber),
    barcode: sanitizeString(details.barcode),
    specifications: specifications && Object.keys(specifications).length > 0 ? specifications : undefined,
    installationApplicable: typeof details.installationApplicable === 'boolean' ? details.installationApplicable : undefined,
    installationCharge: sanitizeNumber(details.installationCharge),
    handleSuggestion: sanitizeString(details.handleSuggestion),
    imageUrl: sanitizeString(details.imageUrl) || fallbackImageUrl,
    productUrl: sanitizeString(details.productUrl) || productUrl,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole('sales');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsedRequest = requestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'A valid product URL is required.' }, { status: 400 });
    }

    const { productUrl, existingData } = parsedRequest.data;

    const cacheKey = `ai:product-details:${crypto.createHash('sha256').update(JSON.stringify(parsedRequest.data)).digest('hex')}`;
    const redis = getRedis();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return NextResponse.json(JSON.parse(cached));
        }
      } catch (_err) {
        // ignore cache read errors
      }
    }

    const pageContext = await fetchPageContext(productUrl);

    const systemPrompt = await getSystemPrompt('product_details');
    const prompt = systemPrompt
      .replace('{schema}', JSON.stringify({
        title: 'string | null',
        vendor: 'string | null',
        brand: 'string | null',
        category: 'string | null',
        productType: 'string | null',
        tags: ['string'],
        description: 'string | null',
        price: 'number | null',
        mrp: 'number | null',
        hsnCode: 'string | null',
        gstRate: 'string | null',
        warranty: 'string | null',
        modelNumber: 'string | null',
        barcode: 'string | null',
        specifications: { key: 'value' },
        installationApplicable: 'boolean | null',
        installationCharge: 'number | null',
        handleSuggestion: 'kebab-case string | null',
        imageUrl: 'string | null',
        productUrl: 'string | null',
      }, null, 2))
      .replace('{existingData}', JSON.stringify(existingData || {}, null, 2))
      .replace('{pageMetadata}', JSON.stringify({
        productUrl,
        title: pageContext.title,
        ogTitle: pageContext.ogTitle,
        description: pageContext.description,
        imageUrl: pageContext.imageUrl,
      }, null, 2))
      .replace('{bodyText}', pageContext.bodyText);

    const rawResponse = await generateGeminiText({
      prompt,
      temperature: 0.2,
      maxOutputTokens: 900,
    });

    const parsedJson = JSON.parse(extractJsonObject(rawResponse));
    const parsedDetails = aiDetailsSchema.parse(parsedJson);
    const details = sanitizeDetails(parsedDetails, pageContext.imageUrl, productUrl);

    logger.info('ai.product_details.generated', {
      userId: auth.user.id,
      role: auth.role,
      productUrl,
      keys: Object.keys(details),
    });

    const responseData = { success: true, details };
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 86400);
      } catch (_err) {
        // ignore cache write errors
      }
    }

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('ai.product_details.error', { error });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}