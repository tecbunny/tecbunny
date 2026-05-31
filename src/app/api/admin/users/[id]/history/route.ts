import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

async function safeListQuery<T>(query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>) {
  const { data, error } = await query;
  if (error) {
    console.error('Admin user history query failed:', error.message || error);
    return [] as T[];
  }
  return data || [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const adminCheck = await requireAdmin(user, supabase);

    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error || 'Unauthorized' }, { status: adminCheck.status || 401 });
    }

    const adminDb = isSupabaseServiceConfigured ? createServiceClient() : supabase;
    const { id: userId } = await params;

    const { data: profile, error: profileError } = await adminDb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Admin user history profile lookup failed:', profileError.message || profileError);
      return NextResponse.json({ error: 'Failed to load user profile' }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [events, orders, leads] = await Promise.all([
      safeListQuery(
        adminDb
          .from('analytics_events')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ),
      safeListQuery(
        adminDb
          .from('orders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ),
      safeListQuery(
        adminDb
          .from('leads')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ),
    ]);

    const messages = profile.email
      ? await safeListQuery(
          adminDb
            .from('contact_messages')
            .select('*')
            .eq('email', profile.email)
            .order('created_at', { ascending: false })
        )
      : [];

    const timeline = [
      ...events.map((event: any) => ({ ...event, type: 'event', timestamp: event.created_at })),
      ...orders.map((order: any) => ({ ...order, type: 'order', timestamp: order.created_at })),
      ...leads.map((lead: any) => ({ ...lead, type: 'lead', timestamp: lead.created_at })),
      ...messages.map((message: any) => ({ ...message, type: 'message', timestamp: message.created_at })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ profile, timeline });
  } catch (error) {
    console.error('Admin user history request failed:', error);
    return NextResponse.json({ error: 'Failed to load user history' }, { status: 500 });
  }
}



