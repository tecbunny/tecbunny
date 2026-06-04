import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function getClientIp(request: NextRequest) {
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  if (!rateLimit(clientIp, 'setup_initial_admins_ip', { limit: 3, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const token = request.headers.get('x-admin-token');
  const isTokenConfigured = process.env.ADMIN_MAINT_TOKEN && process.env.ADMIN_MAINT_TOKEN.length >= 32;

  if (!isTokenConfigured || !token || token !== process.env.ADMIN_MAINT_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service configuration error. Please contact support.' }, { status: 503 });
  }

  try {
    const users = [];
    if (process.env.INITIAL_ADMIN_1_EMAIL && process.env.INITIAL_ADMIN_1_PASSWORD) {
      users.push({
        email: process.env.INITIAL_ADMIN_1_EMAIL,
        password: process.env.INITIAL_ADMIN_1_PASSWORD,
        name: process.env.INITIAL_ADMIN_1_NAME || 'Admin 1',
        mobile: process.env.INITIAL_ADMIN_1_MOBILE || '',
        role: 'admin'
      });
    }
    if (process.env.INITIAL_ADMIN_2_EMAIL && process.env.INITIAL_ADMIN_2_PASSWORD) {
      users.push({
        email: process.env.INITIAL_ADMIN_2_EMAIL,
        password: process.env.INITIAL_ADMIN_2_PASSWORD,
        name: process.env.INITIAL_ADMIN_2_NAME || 'Admin 2',
        mobile: process.env.INITIAL_ADMIN_2_MOBILE || '',
        role: 'admin'
      });
    }

    if (users.length === 0) {
      return NextResponse.json({ error: 'Initial admin credentials environment variables are not configured.' }, { status: 500 });
    }

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
