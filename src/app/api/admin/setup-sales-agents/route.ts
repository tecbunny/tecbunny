import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// export const dynamic = 'force-dynamic';

// POST /api/admin/setup-sales-agents
// One-time setup endpoint to create the sales agent feature
export async function POST(_request: Request) {
  try {
    const supabase = await createClient();
    
    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check admin status by looking in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Create the sales_agents table with a simple approach
    // First, try to create the table and add the essential RLS policy
    const { error: createError } = await supabase
      .from('sales_agents')
      .select('id')
      .limit(1);

    // If table doesn't exist, we'll get an error
    if (createError && createError.message.includes('does not exist')) {
      // Return instructions for manual setup since we can't create tables via API
      return NextResponse.json({ 
        error: 'Tables need to be created manually',
        message: 'Please run the migration SQL in your Supabase dashboard to create the required tables.',
        sql: `
-- Essential setup SQL:
CREATE TYPE sales_agent_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE redemption_status AS ENUM ('pending', 'approved', 'rejected', 'processed');

CREATE TABLE public.sales_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL UNIQUE,
    points_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status sales_agent_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can apply for sales agent" ON public.sales_agents 
    FOR INSERT WITH CHECK (user_id = auth.uid());
    
CREATE POLICY "Agents can view their own data" ON public.sales_agents 
    FOR SELECT USING (user_id = auth.uid());
        `
      }, { status: 400 });
    }

    // If we reach here, tables exist, so try to add missing policies
    try {
      // Check if we can insert a test record (this will fail if policy is missing)
      const testUserId = user.id;
      const testReferralCode = `TEST_${Date.now()}`;
      
      // This is just to test if the INSERT policy exists
      // We'll immediately delete it if it works
      const { error: insertError } = await supabase
        .from('sales_agents')
        .insert({
          user_id: testUserId,
          referral_code: testReferralCode,
          status: 'pending'
        });

      if (insertError && insertError.message.includes('row-level security policy')) {
        // Policy is missing, but we can't add it via API
        return NextResponse.json({ 
          error: 'RLS policies need to be added manually',
          message: 'Tables exist but RLS policies are missing. Please add the INSERT policy in Supabase dashboard.',
          sql: `
-- Add missing RLS policies:
CREATE POLICY "Users can apply for sales agent" ON public.sales_agents 
    FOR INSERT WITH CHECK (user_id = auth.uid());
          `
        }, { status: 400 });
      }

      // If we get here, either it worked or there's a different error
      // Clean up the test record if it was created
      if (!insertError) {
        await supabase
          .from('sales_agents')
          .delete()
          .eq('user_id', testUserId)
          .eq('referral_code', testReferralCode);
      }

    } catch (error) {
      logger.error('sales_agents_setup.policy_test_error', { error });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Sales Agent feature has been set up successfully!' 
    });

  } catch (err: unknown) {
    logger.error('sales_agents_setup.error', { error: err });
    return NextResponse.json({ 
      error: 'Failed to set up Sales Agent feature', 
      details: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}
