import { NextRequest, NextResponse } from 'next/server';

import { createClient, isSupabasePublicConfigured } from '../../../../lib/supabase/server';
import { logger } from '../../../../lib/logger';

// Create client for current user authentication
async function createAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return { supabase, session };
}

// GET /api/auth/session - Get current user session
export async function GET(_request: Request) {
  try {
    if (!isSupabasePublicConfigured) {
      logger.error('auth.session.get.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        },
        { status: 503 }
      );
    }

    const { supabase, session } = await createAuthenticatedClient();
    
    if (!session) {
      return NextResponse.json({ 
        session: null, 
        user: null 
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json({ 
        session: {
          user: session.user,
          expires_at: session.expires_at
        },
        user: {
          id: session.user.id,
          email: session.user.email,
          role: 'customer' // fallback role
        }
      });
    }

    return NextResponse.json({
      session: {
        user: session.user,
        expires_at: session.expires_at
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        name: profile.name,
        role: profile.role,
        customer_category: profile.customer_category,
        discount_percentage: profile.discount_percentage,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }
    });

  } catch (error) {
    console.error('Error in GET /api/auth/session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/auth/session - Refresh session
export async function POST(_request: NextRequest) {
  try {
    if (!isSupabasePublicConfigured) {
      logger.error('auth.session.post.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        },
        { status: 503 }
      );
    }

    const { supabase } = await createAuthenticatedClient();
    
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Error refreshing session:', error);
      return NextResponse.json({ error: 'Failed to refresh session' }, { status: 401 });
    }

    return NextResponse.json({
      session: data.session,
      user: data.user
    });

  } catch (error) {
    console.error('Error in POST /api/auth/session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/auth/session - Sign out
export async function DELETE(_request: NextRequest) {
  try {
    if (!isSupabasePublicConfigured) {
      logger.error('auth.session.delete.missing_supabase_config');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        },
        { status: 503 }
      );
    }

    const { supabase } = await createAuthenticatedClient();
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Signed out successfully' });

  } catch (error) {
    console.error('Error in DELETE /api/auth/session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
