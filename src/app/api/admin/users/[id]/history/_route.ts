import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { isAdmin } = await requireAdmin(user, supabase);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service client to bypass RLS for admin actions
  const adminDb = createServiceClient();
  const { id: userId } = await params;

  // Fetch User Profile
  const { data: profile } = await adminDb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Fetch Analytics Events
  const { data: events } = await adminDb
    .from('analytics_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Fetch Orders
  const { data: orders } = await adminDb
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Fetch Leads/Inquiries
  const { data: leads } = await adminDb
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Fetch Contact Messages (by email)
  let messages: any[] = [];
  if (profile.email) {
    const { data: msgs } = await adminDb
      .from('contact_messages')
      .select('*')
      .eq('email', profile.email)
      .order('created_at', { ascending: false });
    messages = msgs || [];
  }

  // Combine and Sort Timeline
  const timeline = [
    ...(events || []).map(e => ({ ...e, type: 'event', timestamp: e.created_at })),
    ...(orders || []).map(o => ({ ...o, type: 'order', timestamp: o.created_at })),
    ...(leads || []).map(l => ({ ...l, type: 'lead', timestamp: l.created_at })),
    ...messages.map(m => ({ ...m, type: 'message', timestamp: m.created_at })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({
    profile,
    timeline
  });
}

export async function generateStaticParams() {
  return []
}


