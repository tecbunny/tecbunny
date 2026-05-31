import { NextResponse } from 'next/server';

import { createClient, createServiceClient , isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/permissions';
import { logger } from '@/lib/logger';

// export const dynamic = 'force-dynamic';

// GET /api/admin/sales-agents
// Fetches all sales agent applications for admin review.
export async function GET(_request: Request) {
  const supabase = await createClient();

  // 1. Check for an authenticated user and admin privileges
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  if (!await isAdmin(user)) {
    return NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 });
  }

  try {
    // 2. Create service role client for admin operations
    const serviceClient = isSupabaseServiceConfigured ? createServiceClient() : await createClient();
    
    // 3. Fetch all applications using service role to bypass RLS
    const { data: salesAgents, error } = await serviceClient
      .from('sales_agents')
      .select(`
        id,
        user_id,
        referral_code,
        points_balance,
        status,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase fetch error: ${error.message}`);
    }

    // 4. Get user details from auth.users for each agent
    const applications = [];
    for (const agent of salesAgents || []) {
      // Get user details from profiles table
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('email, name')
        .eq('id', agent.user_id)
        .single();

      applications.push({
        ...agent,
        user_details: {
          email: profile?.email || '',
          name: profile?.name || '',
          raw_user_meta_data: {}
        }
      });
    }

    // 5. Return the list of applications
    return NextResponse.json(applications);

  } catch (error: any) {
    logger.error('admin.sales_agents.fetch_failed', { error });
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}
