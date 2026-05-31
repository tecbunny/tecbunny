import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { generateGeminiText } from '../../../../lib/ai/gemini-service';
import { requireRole } from '../../../../lib/auth/guard';
import { logger } from '../../../../lib/logger';
import { getRedis } from '../../../../lib/redis';

const requestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().optional(),
  brand: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireRole('manager');
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json().catch(() => ({}));
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { title, category, brand } = validation.data;

    const cacheKey = `ai:generate-desc:${crypto.createHash('sha256').update(JSON.stringify(validation.data)).digest('hex')}`;
    const redis = getRedis();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return NextResponse.json(JSON.parse(cached));
        }
      } catch (err) {
        // ignore cache read errors
      }
    }

    let prompt = `Generate a professional and detailed product description for an e-commerce website for the following product:
Product Title: "${title}"
`;
    if (category) {
      prompt += `Category: "${category}"\n`;
    }
    if (brand) {
      prompt += `Brand: "${brand}"\n`;
    }

    prompt += `
The description should be well-structured, persuasive, and highlight the key features and benefits of this product. Make it sound professional yet easy to read. Output the description as plain text or simple markdown. Do not include introductory phrases like "Here is the product description".`;

    const description = await generateGeminiText({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1024,
    });

    const responseData = { description };
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 86400);
      } catch (err) {
        // ignore cache write errors
      }
    }

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('ai_generate_description.unexpected_error', { error });
    return NextResponse.json({ error: 'Failed to generate product description' }, { status: 500 });
  }
}
