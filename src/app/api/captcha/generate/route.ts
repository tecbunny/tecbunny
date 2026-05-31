import { NextRequest, NextResponse } from 'next/server';

import { generateSimpleCaptcha, generateImageCaptcha } from '../../../../lib/captcha/captcha-service';

/**
 * POST /api/captcha/generate
 * Generates a new CAPTCHA challenge (for simple CAPTCHA only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = 'math' } = body;
    
    let challenge;
    
    if (type === 'image') {
      challenge = generateImageCaptcha();
    } else {
      challenge = generateSimpleCaptcha();
    }
    
    // Don't send the answer to the client
    const clientChallenge = {
      id: challenge.id,
      question: challenge.question,
      image: challenge.image,
      expires: challenge.expires
    };
    
    return NextResponse.json(clientChallenge);
  } catch (error) {
    console.error('Failed to generate CAPTCHA:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate CAPTCHA challenge' },
      { status: 500 }
    );
  }
}
