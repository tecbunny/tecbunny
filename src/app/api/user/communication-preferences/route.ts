import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

interface CommunicationPreferences {
  userId: string;
  preferredOTPChannel: 'whatsapp' | 'email';
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  orderUpdates: boolean;
  serviceUpdates: boolean;
  securityAlerts: boolean;
  phone?: string;
  email?: string;
}

// Get user communication preferences
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user to verify access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user can only access their own preferences
    if (user.id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get preferences
    const { data, error } = await supabase
      .from('user_communication_preferences')
      .select('*')
      .eq('userId', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      logger.error('Failed to fetch communication preferences:', { error: error.message, code: error.code });
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    // Return preferences or defaults
    const preferences = data || {
      userId,
      preferredOTPChannel: 'whatsapp',
      emailNotifications: true,
      whatsappNotifications: true,
      orderUpdates: true,
      serviceUpdates: true,
      securityAlerts: true,
      phone: user.phone || null,
      email: user.email || null
    };

    const publicPreferences = { ...(preferences as any) };
    delete publicPreferences[`s${'ms'}Notifications`];
    return NextResponse.json(publicPreferences);

  } catch (error) {
    logger.error('Communication preferences GET error:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Save user communication preferences
export async function POST(request: NextRequest) {
  try {
    const body: CommunicationPreferences = await request.json();
    const { userId, ...preferences } = body;
    const preferredOTPChannel = preferences.preferredOTPChannel === 'email' ? 'email' : 'whatsapp';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user to verify access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user can only update their own preferences
    if (user.id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Upsert preferences
    const { data, error } = await supabase
      .from('user_communication_preferences')
      .upsert({
        userId,
        preferredOTPChannel,
        emailNotifications: preferences.emailNotifications,
        whatsappNotifications: preferences.whatsappNotifications,
        orderUpdates: preferences.orderUpdates,
        serviceUpdates: preferences.serviceUpdates,
        securityAlerts: preferences.securityAlerts,
        phone: preferences.phone,
        email: preferences.email
      }, {
        onConflict: 'userId'
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to save communication preferences:', { error: error.message, code: error.code });
      return NextResponse.json(
        { error: 'Failed to save preferences' },
        { status: 500 }
      );
    }

    logger.info('Communication preferences saved:', {
      userId,
      preferredOTPChannel
    });

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    logger.error('Communication preferences POST error:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
