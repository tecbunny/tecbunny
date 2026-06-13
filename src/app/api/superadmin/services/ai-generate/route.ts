import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperadminSessionToken } from '@/lib/auth/superadmin-session';
import { generateGeminiText } from '@/lib/ai/gemini-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const superadminCookie = cookieStore.get('superadmin-session')?.value;
    const isSuperadmin = Boolean(await verifySuperadminSessionToken(superadminCookie));

    if (!isSuperadmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, field } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }

    if (field !== 'description' && field !== 'terms_and_conditions') {
      return NextResponse.json({ error: 'Invalid field parameter. Must be "description" or "terms_and_conditions"' }, { status: 400 });
    }

    let prompt = '';
    if (field === 'description') {
      prompt = `Write a clean, professional, tech-forward description for a service named "${name}". Keep it concise, high-tech, and engaging under 3-4 sentences. Do not use Markdown formatting (like asterisks or bold text) or HTML. Just return plain text.`;
    } else {
      prompt = `Write a comprehensive, professional terms and conditions section for a technology service named "${name}". List 4-5 key terms regarding scope, customer responsibilities, response time, and duration. Do not use Markdown formatting (like bold asterisks, hashes, or list markers) or HTML. Just return clean, plain text paragraphs or simple lines.`;
    }

    const aiText = await generateGeminiText({
      prompt,
      temperature: 0.6,
      maxOutputTokens: 500,
    });

    return NextResponse.json({ success: true, text: aiText });
  } catch (error) {
    logger.error('superadmin_ai_generate_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate content: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
