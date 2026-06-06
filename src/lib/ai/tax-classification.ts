import { z } from 'zod';

import { logger } from '../logger';
import { generateGeminiText } from './gemini-service';

const GST_TIERS = [0, 5, 12, 18, 28] as const;

export type GstTier = typeof GST_TIERS[number];

export interface ProductTaxClassificationInput {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  productType?: unknown;
  targetIndustry?: unknown;
  brand?: unknown;
  modelNumber?: unknown;
  specifications?: unknown;
}

export interface ProductTaxClassification {
  hsn_code: string;
  gst_rate: GstTier;
  confidence_score: number;
  justification: string;
}

export class TaxClassificationError extends Error {
  constructor(message: string, public readonly statusCode = 422) {
    super(message);
    this.name = 'TaxClassificationError';
  }
}

const taxClassificationSchema = z.object({
  hsn_code: z.string().regex(/^\d{8}$/, 'HSN code must be exactly 8 digits'),
  gst_rate: z.coerce.number().refine(
    (value): value is GstTier => GST_TIERS.includes(value as GstTier),
    'GST rate must be one of 0, 5, 12, 18, or 28'
  ),
  confidence_score: z.coerce.number().min(0).max(1),
  justification: z.string().trim().min(20).max(1000),
});

function asCleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 2000) : undefined;
}

function stringifySpecifications(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return asCleanString(value);
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2).slice(0, 4000);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function extractJsonObject(raw: string): string {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : raw.trim();
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new TaxClassificationError('Gemini tax classification did not return a JSON object', 502);
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

export function parseTaxClassification(raw: string): ProductTaxClassification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch (error) {
    if (error instanceof TaxClassificationError) {
      throw error;
    }
    throw new TaxClassificationError('Gemini tax classification returned invalid JSON', 502);
  }

  const result = taxClassificationSchema.safeParse(parsed);
  if (!result.success) {
    throw new TaxClassificationError(
      `Gemini tax classification failed schema validation: ${result.error.issues.map(issue => issue.message).join('; ')}`,
      422
    );
  }

  return {
    hsn_code: result.data.hsn_code,
    gst_rate: result.data.gst_rate as GstTier,
    confidence_score: Math.round(result.data.confidence_score * 100) / 100,
    justification: result.data.justification.trim(),
  };
}

function buildTaxPrompt(input: ProductTaxClassificationInput): string {
  const product = {
    title: asCleanString(input.title),
    description: asCleanString(input.description),
    category: asCleanString(input.category),
    product_type: asCleanString(input.productType),
    target_industry: asCleanString(input.targetIndustry),
    brand: asCleanString(input.brand),
    model_number: asCleanString(input.modelNumber),
    specifications: stringifySpecifications(input.specifications),
  };

  return [
    'You are an Indian GST and HSN classification analyst for a Next.js commerce platform.',
    'Classify the product using Indian customs/GST HSN schedules and standard GST tiers.',
    'Return exactly one JSON object. No markdown, no prose outside JSON, no arrays, no fallback/default values.',
    'The HSN must be the exact most-specific 8-digit HSN code. The GST rate must be one of 0, 5, 12, 18, or 28.',
    'If the product context is sparse, infer from the title, category, technical specifications, target industry, and common Indian statutory treatment, but lower confidence accordingly.',
    'Use this exact schema:',
    JSON.stringify({
      hsn_code: '85258900',
      gst_rate: 18.00,
      confidence_score: 0.95,
      justification: 'Matches IP Closed Circuit Television (CCTV) cameras under electronic electrical equipment schedules.',
    }, null, 2),
    'Product input:',
    JSON.stringify(product, null, 2),
  ].join('\n\n');
}

export async function classifyProductTax(
  input: ProductTaxClassificationInput,
  correlationId?: string
): Promise<ProductTaxClassification> {
  const title = asCleanString(input.title);
  const description = asCleanString(input.description);
  const specifications = stringifySpecifications(input.specifications);

  if (!title && !description && !specifications) {
    throw new TaxClassificationError('Product title, description, or specifications are required for tax classification');
  }

  const prompt = buildTaxPrompt(input);
  let rawResponse: string;

  try {
    rawResponse = await generateGeminiText({
      prompt,
      temperature: 0.1,
      maxOutputTokens: 700,
    });
  } catch (error) {
    logger.error('ai.tax_classification.gemini_failed', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TaxClassificationError('Gemini tax classification failed', 502);
  }

  const classification = parseTaxClassification(rawResponse);
  logger.info('ai.tax_classification.generated', {
    correlationId,
    hsnCode: classification.hsn_code,
    gstRate: classification.gst_rate,
    confidenceScore: classification.confidence_score,
  });

  return classification;
}
