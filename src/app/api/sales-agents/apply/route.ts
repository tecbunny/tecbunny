import { NextResponse } from 'next/server';

import { nanoid } from 'nanoid';

import { createClient } from '@/lib/supabase/server';

// export const dynamic = 'force-dynamic';

// POST /api/sales-agents/apply
// Allows a logged-in user to apply to become a sales agent.
export async function POST(_: Request) {
  const supabase = await createClient();

  // 1. Get the current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'You must be logged in to apply.' }, { status: 401 });
  }

  try {
    // 2. Check if the user has already applied
    const { data: existingApplication, error: checkError } = await supabase
      .from('sales_agents')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = 'exact one row not found'
      throw new Error(`Supabase check error: ${checkError.message}`);
    }

    if (existingApplication) {
      return NextResponse.json({ error: 'You have already submitted an application.' }, { status: 409 });
    }

    // 3. Generate a unique referral code
    const referral_code = `SA-${nanoid(8).toUpperCase()}`;

    // 4. Create the new application record
    const { error: insertError } = await supabase
      .from('sales_agents')
      .insert({
        user_id: user.id,
        referral_code,
        status: 'pending',
      });

    if (insertError) {
      // Handle potential unique constraint violation on referral_code, though unlikely
      if (insertError.code === '23505') {
         return NextResponse.json({ error: 'Could not generate a unique referral code. Please try again.' }, { status: 500 });
      }
      throw new Error(`Supabase insert error: ${insertError.message}`);
    }

    // 5. Return success
    return NextResponse.json({ message: 'Application submitted successfully. You will be notified upon review.' }, { status: 201 });

  } catch (error: any) {
    console.error('Error in sales agent application:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}
