import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { isAdmin } = await requireAdmin(user, supabase);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service client for admin data fetching to bypass RLS
  const adminDb = isSupabaseServiceConfigured ? createServiceClient() : await createClient();

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '7d'; // 7d, 30d, all

  let dateFilter = new Date();
  if (range === '7d') dateFilter.setDate(dateFilter.getDate() - 7);
  if (range === '30d') dateFilter.setDate(dateFilter.getDate() - 30);
  if (range === 'all') dateFilter = new Date(0);

  // Optimize queries to use database-side counting & projection limits concurrently
  const [
    { count: pageViews },
    { count: productViews },
    { count: amcInquiries },
    { count: installationInquiries },
    { data: topProductsData },
    { data: recentLeads }
  ] = await Promise.all([
    adminDb
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'page_view')
      .gte('created_at', dateFilter.toISOString()),
    adminDb
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'product_view')
      .gte('created_at', dateFilter.toISOString()),
    adminDb
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'amc')
      .gte('created_at', dateFilter.toISOString()),
    adminDb
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'installation')
      .gte('created_at', dateFilter.toISOString()),
    adminDb.rpc('get_top_products', {
      p_start_date: dateFilter.toISOString(),
      p_limit: 5
    }),
    adminDb
      .from('leads')
      .select('*')
      .gte('created_at', dateFilter.toISOString())
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  const topProducts = (topProductsData || []).map((row: any) => ({
    id: row.resource_id,
    count: Number(row.count) || 0
  }));

  return NextResponse.json({
    summary: {
      pageViews: pageViews || 0,
      productViews: productViews || 0,
      amcInquiries: amcInquiries || 0,
      installationInquiries: installationInquiries || 0
    },
    topProducts,
    recentLeads: recentLeads || []
  });
}
