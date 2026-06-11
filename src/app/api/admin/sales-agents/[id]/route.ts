import { NextResponse } from 'next/server';

import { createClient, createServiceClient , isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/permissions';

// export const dynamic = 'force-dynamic';

// PATCH /api/admin/sales-agents/[id]
// Updates the status of a sales agent application (approve or reject).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: agentApplicationId } = await params;

  // 1. Check for an authenticated user and admin privileges
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  if (!await isAdmin(user)) {
    return NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 });
  }

  try {
    // 2. Get the new status from the request body
    const { status } = await request.json();

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status provided. Must be "approved" or "rejected".' }, { status: 400 });
    }

    // 3. Use service client to bypass RLS for admin operations
    const serviceClient = isSupabaseServiceConfigured ? createServiceClient() : await createClient();
    
    // 4. Update the application status in the database
    const { data, error } = await serviceClient
      .from('sales_agents')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentApplicationId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
      }
      throw new Error(`Supabase update error: ${error.message}`);
    }

    // 4. Return success
    return NextResponse.json({ message: `Application ${status} successfully.`, application: data });

  } catch (error: any) {
    console.error('Error updating sales agent application:', error);
    if (error.name === 'SyntaxError') {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}



export async function GET() { return Response.json({}) }



