import { NextRequest, NextResponse } from 'next/server';

// GET /api/users-admin - List all users (simplified admin endpoint)
export async function GET(_request: NextRequest) {
  return NextResponse.json({ error: 'Deprecated endpoint. Use /api/users with session authentication.' }, { status: 410 })
}

// (Legacy implementation retained below, commented out to avoid type export issues)
/*
export async function LEGACY_GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminEmail = searchParams.get('adminEmail');
    const adminPassword = searchParams.get('adminPassword');

    if (!adminEmail || !adminPassword) {
      return NextResponse.json({ 
        error: 'Admin credentials required (adminEmail, adminPassword)' 
      }, { status: 401 });
    }

    // Verify admin access
    const verification = await verifyAdminAccess(adminEmail, adminPassword);
    if (!verification.valid) {
      return NextResponse.json({ error: verification.error }, { status: 403 });
    }

    // Get users with profiles using admin client
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get profiles for all users
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 });
    }

    // Combine auth and profile data
    const usersWithProfiles = users.map(user => {
      const profile = profiles.find(p => p.id === user.id);
      return {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        banned_until: (user as { banned_until?: string | null }).banned_until || null,
        profile: profile || null
      };
    });

    return NextResponse.json({
      users: usersWithProfiles,
      total: users.length,
      message: 'Users retrieved successfully'
    });

  } catch (_error) {
    console.error('Error in GET /api/users-admin:', _error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users-admin - Create new user
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Deprecated endpoint. Use /api/users with session authentication.' }, { status: 410 })
}

export async function LEGACY_POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminEmail, adminPassword, email, password, name, role = 'customer' } = body;

    if (!adminEmail || !adminPassword) {
      return NextResponse.json({ 
        error: 'Admin credentials required' 
      }, { status: 401 });
    }

    // Verify admin access
    const verification = await verifyAdminAccess(adminEmail, adminPassword);
    if (!verification.valid) {
      return NextResponse.json({ error: verification.error }, { status: 403 });
    }

    if (!email || !password || !name) {
      return NextResponse.json({ 
        error: 'Email, password, and name are required' 
      }, { status: 400 });
    }

    // Create user with admin client
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json({ 
        error: createError.message || 'Failed to create user' 
      }, { status: 400 });
    }

    // Create profile
    if (userData.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userData.user.id,
          name,
          email,
          role,
          is_active: true
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        console.error('Profile error details:', JSON.stringify(profileError, null, 2));
        
        // Check if it's a duplicate key error
        if (profileError.message.includes('duplicate key') || profileError.code === '23505') {
          // Profile might already exist, try to update instead
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
              name,
              email,
              role,
              is_active: true
            })
            .eq('id', userData.user.id);
          
          if (updateError) {
            console.error('Error updating existing profile:', updateError);
            await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
            return NextResponse.json({ 
              error: `Failed to update user profile: ${updateError.message}` 
            }, { status: 500 });
          }
        } else {
          // Try to clean up the auth user if profile creation failed
          await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
          return NextResponse.json({ 
            error: `Failed to create user profile: ${profileError.message}` 
          }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: userData.user?.id,
        email: userData.user?.email,
        created_at: userData.user?.created_at
      }
    });

  } catch (error) {
    console.error('Error in POST /api/users-admin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
*/
