import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin-auth';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { isAdmin } = await requireAdmin(user, supabase);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service client for admin data fetching to bypass RLS
  const adminDb = createServiceClient();

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '7d'; // 7d, 30d, all

  let dateFilter = new Date();
  if (range === '7d') dateFilter.setDate(dateFilter.getDate() - 7);
  if (range === '30d') dateFilter.setDate(dateFilter.getDate() - 30);
  if (range === 'all') dateFilter = new Date(0);

  // Fetch Analytics Events
  const { data: events } = await adminDb
    .from('analytics_events')
    .select('*')
    .gte('created_at', dateFilter.toISOString());

  // Fetch Leads
  const { data: leads } = await adminDb
    .from('leads')
    .select('*')
    .gte('created_at', dateFilter.toISOString());

  // Process Data
  const pageViews = events?.filter(e => e.event_type === 'page_view').length || 0;
  const productViews = events?.filter(e => e.event_type === 'product_view').length || 0;
  const amcInquiries = leads?.filter(l => l.type === 'amc').length || 0;
  const installationInquiries = leads?.filter(l => l.type === 'installation').length || 0;

  // Top Products
  const productStats = events
    ?.filter(e => e.event_type === 'product_view' && e.resource_id)
    .reduce((acc: any, curr) => {
      acc[curr.resource_id] = (acc[curr.resource_id] || 0) + 1;
      return acc;
    }, {});

  const topProducts = Object.entries(productStats || {})
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({ id, count }));

  return NextResponse.json({
    summary: {
      pageViews,
      productViews,
      amcInquiries,
      installationInquiries
    },
    topProducts,
    recentLeads: leads?.slice(0, 10) || []
  });
}
