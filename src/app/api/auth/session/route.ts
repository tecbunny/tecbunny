import { NextRequest, NextResponse } from 'next/server';

import { createClient, isSupabasePublicConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Create client for current user authentication
async function createAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return { supabase, session };
}

// GET /api/auth/session - Get current user session
export async function GET(request: NextRequest) {
  try {
    // Check superadmin session cookie first
    const superadminCookie = request.cookies.get('superadmin-session')?.value;
    if (superadminCookie) {
      const correctEmail = process.env.SUPERADMIN_USER_ID || process.env.SUPERADMIN_EMAIL;
      const correctPassword = process.env.SUPERADMIN_PASSWORD;
      if (correctEmail && correctPassword) {
        const secret = process.env.SUPERADMIN_PASSWORD || 'superadmin_salt_key_default';
        const msgBuffer = new TextEncoder().encode(`${correctEmail}:${correctPassword}:${secret}`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const expectedToken = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (superadminCookie === expectedToken) {
          return NextResponse.json({
            session: {
              user: { id: 'superadmin-root-id', email: correctEmail },
              expires_at: Math.floor(Date.now() / 1000) + 86400
            },
            user: {
              id: 'superadmin-root-id',
              email: correctEmail,
              name: 'System Super Administrator',
              role: 'superadmin',
              customer_category: 'standard',
              discount_percentage: 0
            }
          });
        }
      }
    }

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
