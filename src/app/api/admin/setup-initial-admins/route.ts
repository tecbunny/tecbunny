import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function isAuthorized(req: NextRequest) {
  const token = req.headers.get('x-admin-token');
  return !!token && token === process.env.ADMIN_MAINT_TOKEN;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service configuration error. Please contact support.' }, { status: 503 });
  }

  try {
    const users = [
      {
        email: 'tecbunnysolution@gmail.com',
        password: 'Bunny@6010',
        name: 'Shubham Bhisaji',
        mobile: '9604136010',
        role: 'admin'
      },
      {
        email: 'tecbunnysolutions@gmail.com',
        password: 'Bunny@6010',
        name: 'Shubham Bhisaji',
        mobile: '7387375651',
        role: 'admin'
      }
    ];

    const results = [];

    for (const userData of users) {
      const { email, password, name, mobile, role } = userData;

      // Check if user already exists
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, role')
        .eq('email', email)
        .maybeSingle();

      let userId: string;

      if (existingProfile?.id) {
        // Update existing user
        userId = existingProfile.id;
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true
        });

        // Update profile
        await supabaseAdmin
          .from('profiles')
          .update({
            name,
            mobile,
            role,
            is_active: true,
            email_verified: true
          })
          .eq('id', userId);
      } else {
        // Create new user
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role, name }
        });

        if (createErr || !created.user) {
          results.push({ email, status: 'error', error: createErr?.message || 'Failed to create user' });
          continue;
        }

        userId = created.user.id;

        // Create profile
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            email,
            name,
            mobile,
            role,
            is_active: true,
            email_verified: true
          });
      }

      results.push({ email, status: 'success', userId, role });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin users setup completed',
      results
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
