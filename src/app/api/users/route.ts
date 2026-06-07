import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

import { resolveSiteUrl } from '@/lib/site-url';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getEffectiveUserRole } from '@/lib/auth/server-role';
import { verifySuperadminSessionToken } from '@/lib/auth/superadmin-session';
import { logger } from '@/lib/logger';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const STAFF_ROLES = ['admin', 'manager', 'accounts'];
const ROLE_SENTINEL_NONE = '__none__';
const SORTABLE_COLUMNS: Record<string, string> = {
  name: 'name',
  email: 'email',
  role: 'role',
  customerCategory: 'customer_category',
  discountPercentage: 'discount_percentage',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_ANON_KEY);
}

// Create admin client for user management lazily
const getSupabaseAdmin = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }
  return createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

const createAnonClient = () => createClient(
  SUPABASE_URL!,
  SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const parseCsvParam = (value: string | null) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

async function getUserTotals() {
  const [totalRes, staffRes, customerRes, salesRes] = await Promise.all([
    getSupabaseAdmin().from('profiles').select('id', { count: 'exact', head: true }),
    getSupabaseAdmin().from('profiles').select('id', { count: 'exact', head: true }).in('role', STAFF_ROLES),
    getSupabaseAdmin().from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    getSupabaseAdmin().from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'sales')
  ]);

  return {
    total: totalRes.count ?? 0,
    staff: staffRes.count ?? 0,
    customers: customerRes.count ?? 0,
    sales: salesRes.count ?? 0
  };
}

// Create client for current user authentication
async function createAuthenticatedClient(request: NextRequest) {
  // Check superadmin session cookie first
  const superadminCookie = request.cookies.get('superadmin-session')?.value;
  const superadminPayload = await verifySuperadminSessionToken(superadminCookie);
  if (superadminPayload) {
    return {
      supabase: getSupabaseAdmin(),
      session: { user: { id: 'superadmin-root-id', email: superadminPayload.email } } as any,
      role: 'superadmin'
    };
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const supabase = createAnonClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        const role = await getEffectiveUserRole(data.user);
        return { supabase, session: { user: data.user }, role };
      }
    }
  }

  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const role = session ? await getEffectiveUserRole(session.user) : null;
  return { supabase, session, role };
}

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    // Security: Admin / Superadmin Only
    const { session, role } = await createAuthenticatedClient(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!role || !['admin', 'manager', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    const pageParam = Number(searchParams.get('page'));
    const pageSizeParam = Number(searchParams.get('pageSize'));
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? Math.min(Math.floor(pageSizeParam), 100) : 25;
    const offset = (page - 1) * pageSize;

    const search = (searchParams.get('search') || '').trim();
    let roles = parseCsvParam(searchParams.get('role'));
    const status = searchParams.get('status');
    const customerCategories = parseCsvParam(searchParams.get('customerCategory'));
    const discountMinParam = searchParams.get('discountMin');
    const discountMaxParam = searchParams.get('discountMax');
    const sortFieldParam = searchParams.get('sortField') || 'name';
    const sortDirectionParam = searchParams.get('sortDirection') === 'desc' ? 'desc' : 'asc';
    const includeCounts = searchParams.get('includeCounts') !== 'false';

    const sortColumn = SORTABLE_COLUMNS[sortFieldParam] || SORTABLE_COLUMNS.name;
    const discountMin = discountMinParam !== null && discountMinParam !== '' ? Number(discountMinParam) : null;
    const discountMax = discountMaxParam !== null && discountMaxParam !== '' ? Number(discountMaxParam) : null;

    let totals = null;
    if (includeCounts) {
      try {
        if (role === 'superadmin') {
          totals = await getUserTotals();
        } else {
          const customerRes = await getSupabaseAdmin().from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer');
          const customerCount = customerRes.count ?? 0;
          totals = {
            total: customerCount,
            staff: 0,
            customers: customerCount,
            sales: 0
          };
        }
      } catch (totalsError) {
        logger.error('users.fetch_totals_failed', { error: totalsError });
      }
    }

    // Force non-superadmins to only view standard customers
    if (role !== 'superadmin') {
      roles = ['customer'];
    }

    if (roles.includes(ROLE_SENTINEL_NONE)) {
      return NextResponse.json({
        users: [],
        total: 0,
        page,
        pageSize,
        totals
      });
    }

    let profileQuery = getSupabaseAdmin()
      .from('profiles')
      .select('*', { count: 'exact' });

    if (roles.length) {
      profileQuery = profileQuery.in('role', roles);
    }

    if (status === 'active') {
      profileQuery = profileQuery.eq('is_active', true);
    } else if (status === 'inactive') {
      profileQuery = profileQuery.eq('is_active', false);
    }

    if (customerCategories.length) {
      profileQuery = profileQuery.in('customer_category', customerCategories);
    }

    if (discountMin !== null && Number.isFinite(discountMin)) {
      profileQuery = profileQuery.gte('discount_percentage', discountMin);
    }

    if (discountMax !== null && Number.isFinite(discountMax)) {
      profileQuery = profileQuery.lte('discount_percentage', discountMax);
    }

    if (search) {
      const sanitizedSearch = search.replace(/[%_]/g, (match) => `\\${match}`);
      const pattern = `%${sanitizedSearch}%`;
      profileQuery = profileQuery.or(
        `name.ilike.${pattern},email.ilike.${pattern},mobile.ilike.${pattern}`
      );
    }

    const { data: profiles, count, error } = await profileQuery
      .order(sortColumn, { ascending: sortDirectionParam === 'asc', nullsFirst: sortDirectionParam === 'asc' })
      .range(offset, offset + pageSize - 1);

    if (error) {
      logger.error('users.fetch_profiles_failed', { error });
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const authUsers = await Promise.all(
      (profiles || []).map(async (profile: any) => {
        try {
          const { data, error: userError } = await getSupabaseAdmin().auth.admin.getUserById(profile.id);
          if (userError || !data?.user) {
            logger.warn('users.auth_lookup_failed', { userId: profile.id, error: userError });
            return null;
          }
          return data.user;
        } catch (authLookupError) {
          logger.error('users.auth_lookup_exception', { userId: profile.id, error: authLookupError });
          return null;
        }
      })
    );

    const combinedUsers = (profiles || []).map((profile: any, index: number) => {
      const authUser = authUsers[index];
      return {
        id: profile.id,
        email: authUser?.email ?? profile.email ?? null,
        email_confirmed_at: authUser?.email_confirmed_at ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        created_at: authUser?.created_at ?? profile.created_at ?? null,
        updated_at: authUser?.updated_at ?? profile.updated_at ?? null,
        banned_until: (authUser as { banned_until?: string })?.banned_until ?? null,
        profile
      };
    });

    return NextResponse.json({
      users: combinedUsers,
      total: count ?? combinedUsers.length,
      page,
      pageSize,
      totals
    });
  } catch (error) {
    logger.error('Error in GET /api/users:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      logger.error('users.supabase_configuration_missing');
      return NextResponse.json({ error: 'Service configuration error' }, { status: 503 });
    }
    const { session, role } = await createAuthenticatedClient(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin, manager or superadmin
    if (!role || !['admin', 'manager', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const email = body.email as string | undefined;
    const name = body.name as string | undefined;
    const requestedRole = (body.role as string | undefined) || 'customer';
    const mobile = body.mobile as string | undefined;
    let password = body.password as string | undefined;

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    // Reject requests if a non-superadmin tries to create an account with a role other than 'customer'
    if (role !== 'superadmin' && requestedRole !== 'customer') {
      return NextResponse.json({ error: 'Forbidden: Admins can only create customer profiles' }, { status: 403 });
    }

    // Auto-generate a strong password if not provided using CSPRNG
    if (!password || password.trim() === '') {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+';
      const random = (len: number) => {
        let str = '';
        for (let i = 0; i < len; i++) {
          str += chars.charAt(crypto.randomInt(0, chars.length));
        }
        return str;
      };
      password = `${random(4)}-${random(4)}-${random(4)}`; // e.g., Ab9!-xY7@-Kp3#
    }

    // Create user with admin client, mark email as confirmed
    const { data: userData, error: createError } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: requestedRole
      }
    });

    if (createError) {
      logger.error('Error creating user:', { error: createError });
      return NextResponse.json({ 
        error: createError.message || 'Failed to create user' 
      }, { status: 400 });
    }

    // Create or update profile with additional fields
    if (userData.user) {
      const { error: profileError } = await getSupabaseAdmin()
        .from('profiles')
        .upsert({
          id: userData.user.id,
          name,
          email,
          role: requestedRole,
          mobile: mobile || null,
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileError) {
        logger.error('Error creating profile:', { error: profileError });
        // Try to clean up the auth user if profile creation failed
        await getSupabaseAdmin().auth.admin.deleteUser(userData.user.id);
        return NextResponse.json({ 
          error: 'Failed to create user profile' 
        }, { status: 500 });
      }
    }

    // Send credentials via email (no verification required)
    try {
      const improvedEmailService = (await import('@/lib/improved-email-service')).default;
      const siteUrl = resolveSiteUrl(request.headers.get('host') || undefined);
      const subject = 'Your Account Has Been Created - TecBunny Store';
      const html = `
        <div style="font-family: Arial, sans-serif; line-height:1.6;">
          <h2>Welcome to TecBunny Store, ${name}!</h2>
          <p>Your account was created by an administrator. Email verification is not required.</p>
          <p><strong>Login Email:</strong> ${email}<br/>
             <strong>Temporary Password:</strong> ${password}</p>
          <p>
            You can sign in here: <a href="${siteUrl}/auth/signin">${siteUrl}/auth/signin</a><br/>
            For security, please change your password after first login from your profile settings.
          </p>
          <p>If you didn’t expect this, contact support at sales@tecbunny.com.</p>
        </div>
      `;
      await improvedEmailService.sendEmail({ to: email, subject, html });
    } catch (e) {
      logger.error('Failed to send credentials email:', { error: e });
      // Continue without failing the request
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
    logger.error('Error in POST /api/users:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/users - Update user (admin only)
export async function PUT(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      logger.error('users.supabase_configuration_missing');
      return NextResponse.json({ error: 'Service configuration error' }, { status: 503 });
    }
    const { session, role } = await createAuthenticatedClient(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin, manager or superadmin
    if (!role || !['admin', 'manager', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, updates } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch target profile first to enforce RBAC limits
    const { data: targetProfile, error: fetchError } = await getSupabaseAdmin()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (fetchError || !targetProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (role !== 'superadmin') {
      // Reject if non-superadmin attempts to update a non-customer profile
      if (targetProfile.role !== 'customer') {
        return NextResponse.json({ error: 'Forbidden: Admins cannot update non-customer profiles' }, { status: 403 });
      }
      // Reject if non-superadmin attempts to change a user's role to something other than 'customer'
      if (updates.role && updates.role !== 'customer') {
        return NextResponse.json({ error: 'Forbidden: Admins cannot change profile role to non-customer' }, { status: 403 });
      }
    }

    // Update user metadata if provided
    if (updates.email || updates.password || updates.email_confirm !== undefined) {
      const authUpdates: {
        email?: string;
        password?: string;
        email_confirm?: boolean;
      } = {};
      if (updates.email) authUpdates.email = updates.email;
      if (updates.password) authUpdates.password = updates.password;
      if (updates.email_confirm !== undefined) authUpdates.email_confirm = updates.email_confirm;

      const { error: authError } = await getSupabaseAdmin().auth.admin.updateUserById(userId, authUpdates);
      
      if (authError) {
        logger.error('Error updating auth user:', { error: authError });
        return NextResponse.json({ 
          error: authError.message || 'Failed to update user' 
        }, { status: 400 });
      }
    }

    // Update profile if provided
    if (updates && Object.keys(updates).length > 0) {
      // Build update object, accepting both camelCase and snake_case keys
      const profileUpdates: Record<string, any> = {};
      if (updates.name) profileUpdates.name = updates.name;
      if (updates.role) profileUpdates.role = updates.role;
      if (updates.mobile) profileUpdates.mobile = updates.mobile;
      if (typeof updates.is_active === 'boolean') profileUpdates.is_active = updates.is_active;
      if (typeof updates.isActive === 'boolean') profileUpdates.is_active = updates.isActive;
      if (updates.address) profileUpdates.address = updates.address;
      if (updates.gstin) profileUpdates.gstin = updates.gstin;

      const customerCategory = updates.customer_category ?? updates.customerCategory;
      if (customerCategory) profileUpdates.customer_category = customerCategory;

      if (updates.discount_percentage !== undefined) profileUpdates.discount_percentage = updates.discount_percentage;
      if (updates.discountPercentage !== undefined) profileUpdates.discount_percentage = updates.discountPercentage;

      // Always stamp updated_at
      profileUpdates.updated_at = new Date().toISOString();

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await getSupabaseAdmin()
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId);

        if (profileError) {
          logger.error('Error updating profile:', { error: profileError });
          return NextResponse.json({ 
            error: 'Failed to update user profile' 
          }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ message: 'User updated successfully' });

  } catch (error) {
    logger.error('Error in PUT /api/users:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users - Delete user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      logger.error('users.supabase_configuration_missing');
      return NextResponse.json({ error: 'Service configuration error' }, { status: 503 });
    }
    const { session, role } = await createAuthenticatedClient(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or superadmin
    if (!role || !['admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Don't allow deleting self
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Fetch target profile first to enforce RBAC limits
    const { data: targetProfile, error: fetchError } = await getSupabaseAdmin()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (fetchError || !targetProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (role !== 'superadmin') {
      // Block non-superadmins from deleting profiles where role is not 'customer'
      if (targetProfile.role !== 'customer') {
        return NextResponse.json({ error: 'Forbidden: Admins cannot delete non-customer profiles' }, { status: 403 });
      }
    }

    // Delete user (this will cascade to profile due to foreign key)
    const { error: deleteError } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
    
    if (deleteError) {
      logger.error('Error deleting user:', { error: deleteError });
      return NextResponse.json({ 
        error: deleteError.message || 'Failed to delete user' 
      }, { status: 400 });
    }

    return NextResponse.json({ message: 'User deleted successfully' });

  } catch (error) {
    logger.error('Error in DELETE /api/users:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
