import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Call the password validation function
    const { data, error } = await supabase
      .rpc('validate_password_strength', { password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      validation: data
    });

  } catch (error) {
    logger.error('Error validating password:', { error });
    return NextResponse.json(
      { error: 'Failed to validate password' },
      { status: 500 }
    );
  }
}
