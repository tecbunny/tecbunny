import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { generateGeminiText } from '@/lib/ai/gemini-service';
import { getProductDisplayImage } from '@/lib/image-utils';
import { getRedis } from '@/lib/redis';
import { getSystemPrompt } from '@/lib/ai/prompts';

const MAX_SOURCES = 3;
const MAX_SOURCE_CHARS = 3500;
const EXTERNAL_FETCH_TIMEOUT_MS = 10000;

const PRICE_PATTERN = /(₹|\$|€|£|INR|USD|EUR|GBP|Rs\.?|Rs\s|INR\s|USD\s|EUR\s|GBP\s)\s?[0-9][0-9,]*(?:\.[0-9]{1,2})?/gi;
const PRICE_WORD_PATTERN = /\b(price|pricing|cost|mrp|offer|discount|rate|rs\b|usd\b|inr\b|eur\b|gbp\b)\b/gi;

function redactPrices(input: string) {
  if (!input) return '';
  return input
    .replace(PRICE_PATTERN, '[redacted]')
    .replace(PRICE_WORD_PATTERN, '');
}

function normalizeSourceUrl(url: string) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function cleanSearchText(value: string, maxLength = 80) {
  return value
    .trim()
    .replace(/[%_*]/g, '')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSearchUrls(query: string): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  const searchUrl = `https://r.jina.ai/http://duckduckgo.com/html/?q=${encoded}`;
  const response = await fetchWithTimeout(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) return [];
  const html = await response.text();

  const urls: string[] = [];
  const uddgMatches = [...html.matchAll(/uddg=([^&"']+)/gi)];
  for (const match of uddgMatches) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (decoded.startsWith('http')) {
        urls.push(decoded);
      }
    } catch {
      // ignore decode errors
    }
  }

  const hrefMatches = [...html.matchAll(/href="(https?:\/\/[^\"\s]+)"/gi)];
  for (const match of hrefMatches) {
    urls.push(match[1]);
  }

  return uniqueStrings(urls)
    .filter((url) => !url.includes('duckduckgo.com'))
    .slice(0, MAX_SOURCES);
}

async function fetchReadableContent(url: string): Promise<string> {
  const readerUrl = `https://r.jina.ai/http://${url}`;
  const response = await fetchWithTimeout(readerUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) return '';
  const text = await response.text();
  return redactPrices(text).slice(0, MAX_SOURCE_CHARS);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const urls = Array.isArray(body?.urls) ? body.urls : [];

    if (!query) {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 });
    }
    const safeQuery = cleanSearchText(query);
    if (!safeQuery) {
      return NextResponse.json({ error: 'Query must contain searchable text.' }, { status: 400 });
    }

    const cacheKey = `ai:research:${crypto.createHash('sha256').update(JSON.stringify({ query: safeQuery, urls })).digest('hex')}`;
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

    const supabase = await createClient();
    const { data: products } = await supabase
      .from('products')
      .select('id,title,name,description,product_type,category,tags,images,image,additional_images,brand,specifications')
      .ilike('title', `%${safeQuery}%`)
      .limit(5);

    const safeProducts = (products || []).map((product) => ({
      id: product.id,
      title: product.title || product.name || 'Product',
      description: redactPrices(product.description || ''),
      category: product.category || null,
      brand: product.brand || null,
      productType: product.product_type || null,
      tags: Array.isArray(product.tags) ? product.tags : [],
      specifications: product.specifications || null,
      image: getProductDisplayImage(product),
      images: [
        getProductDisplayImage(product),
        ...(Array.isArray(product.images) ? product.images : []),
        ...(Array.isArray(product.additional_images) ? product.additional_images : []),
      ].filter(Boolean),
    }));

    const requestedUrls = uniqueStrings(
      urls
        .map((url: string) => (typeof url === 'string' ? url.trim() : ''))
        .map((url: string) => normalizeSourceUrl(url))
        .filter(Boolean) as string[]
    );

    const sourceUrls = requestedUrls.length
      ? requestedUrls.slice(0, MAX_SOURCES)
      : await fetchSearchUrls(query);

    const sources: { url: string; content: string }[] = [];
    for (const url of sourceUrls) {
      const content = await fetchReadableContent(url);
      if (content) {
        sources.push({ url, content });
      }
    }

    const productContext = safeProducts
      .map((product, index) => {
        const parts = [
          `Product ${index + 1}: ${product.title}`,
          product.category ? `Category: ${product.category}` : null,
          product.brand ? `Brand: ${product.brand}` : null,
          product.productType ? `Type: ${product.productType}` : null,
          product.tags?.length ? `Tags: ${product.tags.join(', ')}` : null,
          product.description ? `Description: ${product.description}` : null,
        ].filter(Boolean);
        return parts.join('\n');
      })
      .join('\n\n');

    const sourceContext = sources
      .map((source, index) => `Source ${index + 1} (${source.url}):\n${source.content}`)
      .join('\n\n');

    const systemPrompt = await getSystemPrompt('research');
    const prompt = systemPrompt
      .replace('{query}', query)
      .replace('{productContext}', productContext || 'No internal product data available for this query.')
      .replace('{sourceContext}', sourceContext || 'No external sources were available. Rely on product information provided.');

    let rawResponse = await generateGeminiText({
      prompt,
      temperature: 0.3,
      maxOutputTokens: 4000,
    });

    let summary = redactPrices(rawResponse);

    if (summary.replace(/\s+/g, ' ').trim().length < 300) {
      const expandPrompt = `${prompt}

The previous response was too brief. Expand each section with 2-4 sentences and keep the same headings.`;
      rawResponse = await generateGeminiText({
        prompt: expandPrompt,
        temperature: 0.3,
        maxOutputTokens: 1400,
      });
      summary = redactPrices(rawResponse);
    }

    const responseData = {
      summary,
      products: safeProducts,
      sources: sources.map((source) => source.url),
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 86400);
      } catch (_err) {
        // ignore cache write errors
      }
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate AI research.' },
      { status: 500 }
    );
  }
}
