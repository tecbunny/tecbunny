import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const getSupabaseAdmin = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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
    // Edge Environment Protection: Block setup if any admin already exists
    const { data: existingAdmins, error: adminCheckError } = await getSupabaseAdmin()
      .from('profiles')
      .select('id')
      .in('role', ['admin'])
      .limit(1);

    if (adminCheckError) {
      return NextResponse.json({ error: 'Database check failed' }, { status: 500 });
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json({ error: 'Initialization is already complete and locked' }, { status: 403 });
    }

    const users = [];

    // Admin seed
    const adminEmail = process.env.ADMIN_SEED_EMAIL || process.env.SEED_ADMIN_EMAIL || process.env.INITIAL_ADMIN_1_EMAIL;
    const adminPassword = process.env.ADMIN_SEED_PASSWORD || process.env.SEED_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_1_PASSWORD;
    if (adminEmail && adminPassword) {
      users.push({
        email: adminEmail,
        password: adminPassword,
        name: process.env.SEED_ADMIN_NAME || process.env.INITIAL_ADMIN_1_NAME || 'Admin',
        mobile: process.env.SEED_ADMIN_MOBILE || process.env.INITIAL_ADMIN_1_MOBILE || '',
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
      const { data: existingProfile } = await getSupabaseAdmin()
        .from('profiles')
        .select('id, email, role')
        .eq('email', email)
        .maybeSingle();

      let userId: string;

      if (existingProfile?.id) {
        // Update existing user
        userId = existingProfile.id;
        await getSupabaseAdmin().auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          app_metadata: { role },
          user_metadata: { name }
        });

        // Update profile
        await getSupabaseAdmin()
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
        const { data: created, error: createErr } = await getSupabaseAdmin().auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { role },
          user_metadata: { name }
        });

        if (createErr || !created.user) {
          results.push({ email, status: 'error', error: createErr?.message || 'Failed to create user' });
          continue;
        }

        userId = created.user.id;

        // Create profile
        await getSupabaseAdmin()
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
