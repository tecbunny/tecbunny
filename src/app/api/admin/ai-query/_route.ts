import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, isSupabaseServiceConfigured } from '../../../../lib/supabase/server';
import { isAtLeast } from '../../../../lib/roles';
import { logger } from '../../../../lib/logger';
import { generateGeminiText } from '../../../../lib/ai/gemini-service';

const ADMIN_REPORT_HINT = `You are the TecBunny admin assistant. Provide concise, factual responses. If data is missing, say so.`;

const isQueryMatch = (query: string, patterns: Array<string | RegExp>) =>
  patterns.some((pattern) =>
    typeof pattern === 'string' ? query.includes(pattern) : pattern.test(query)
  );

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'customer';
    if (!isAtLeast(role, 'manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const rawQuery = body.query || '';
    const query = String(rawQuery).toLowerCase();

    const wantsOrders = isQueryMatch(query, ['order', 'sales', 'revenue']);
    const wantsCustomers = isQueryMatch(query, ['customer', 'users', 'clients']);
    const wantsProducts = isQueryMatch(query, ['product', 'inventory', 'stock']);
    const wantsServices = isQueryMatch(query, ['service']);
    const wantsAnalytics = isQueryMatch(query, ['analytics', 'views', 'page view', 'product view']);
    const wantsRelated = isQueryMatch(query, ['related', 'recommend', 'requirements', 'requirement']);

    const contextData: Record<string, unknown> = {};
    let dataPayload: any = null;

    const adminClient = isSupabaseServiceConfigured ? createServiceClient() : supabase;

    try {
      if (wantsOrders) {
        const since = new Date();
        since.setDate(since.getDate() - 30);

        const [{ count: totalOrders }, { data: recentOrders }, { data: monthlyOrders }] = await Promise.all([
          adminClient.from('orders').select('*', { count: 'exact', head: true }),
          adminClient.from('orders').select('id, total, status, created_at, customer_name').order('created_at', { ascending: false }).limit(8),
          adminClient.from('orders').select('total, created_at').gte('created_at', since.toISOString()),
        ]);

        const revenue30d = (monthlyOrders || []).reduce((sum, order: any) => sum + Number(order.total || 0), 0);

        contextData.orders = {
          totalOrders: totalOrders ?? 0,
          revenue30d,
          recentOrders: recentOrders || [],
        };

        dataPayload = {
          type: 'orders_report',
          summary: {
            totalOrders: totalOrders ?? 0,
            revenue30d,
          },
          items: recentOrders || [],
        };
      }

      if (wantsCustomers) {
        const [{ count: totalCustomers }, { data: recentCustomers }] = await Promise.all([
          adminClient.from('profiles').select('*', { count: 'exact', head: true }),
          adminClient.from('profiles').select('id, name, email, created_at, role').order('created_at', { ascending: false }).limit(6),
        ]);

        contextData.customers = {
          totalCustomers: totalCustomers ?? 0,
          recentCustomers: recentCustomers || [],
        };

        dataPayload = {
          type: 'customers_report',
          summary: {
            totalCustomers: totalCustomers ?? 0,
          },
          items: recentCustomers || [],
        };
      }

      if (wantsProducts) {
        const [{ count: totalProducts }, { data: lowStock }, { data: topViewed }] = await Promise.all([
          adminClient.from('products').select('*', { count: 'exact', head: true }),
          adminClient.from('products').select('id, title, stock_quantity').lt('stock_quantity', 10).limit(6),
          adminClient.from('product_analytics_view').select('id, title, view_count').order('view_count', { ascending: false }).limit(6),
        ]);

        contextData.products = {
          totalProducts: totalProducts ?? 0,
          lowStock: lowStock || [],
          topViewed: topViewed || [],
        };

        dataPayload = {
          type: 'products_report',
          summary: {
            totalProducts: totalProducts ?? 0,
          },
          items: topViewed || lowStock || [],
        };
      }

      if (wantsServices) {
        const [{ count: totalServices }, { data: activeServices }] = await Promise.all([
          adminClient.from('services').select('*', { count: 'exact', head: true }),
          adminClient.from('services').select('id, title, is_active').eq('is_active', true).limit(6),
        ]);

        contextData.services = {
          totalServices: totalServices ?? 0,
          activeServices: activeServices || [],
        };

        dataPayload = {
          type: 'services_report',
          summary: {
            totalServices: totalServices ?? 0,
          },
          items: activeServices || [],
        };
      }

      if (wantsAnalytics) {
        const since = new Date();
        since.setDate(since.getDate() - 7);

        const [{ data: events }, { data: leads }] = await Promise.all([
          adminClient.from('analytics_events').select('event_type, created_at, resource_id').gte('created_at', since.toISOString()),
          adminClient.from('leads').select('type, status, created_at, customer_name').gte('created_at', since.toISOString()),
        ]);

        const pageViews = (events || []).filter((e: any) => e.event_type === 'page_view').length;
        const productViews = (events || []).filter((e: any) => e.event_type === 'product_view').length;

        contextData.analytics = {
          pageViews,
          productViews,
          recentLeads: leads || [],
        };

        dataPayload = {
          type: 'analytics_report',
          summary: { pageViews, productViews },
          items: leads || [],
        };
      }

      if (wantsRelated) {
        const requirement = rawQuery;
        const { data: products } = await adminClient
          .from('products')
          .select('id, title, description, category, product_type, vendor, brand, tags, price, image');

        const tokens = String(requirement)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(Boolean);

        const scored = (products || [])
          .map((product: any) => {
            const haystack = [
              product.title,
              product.description,
              product.category,
              product.product_type,
              product.vendor,
              product.brand,
              Array.isArray(product.tags) ? product.tags.join(' ') : product.tags,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            const score = tokens.reduce((sum: number, token: string) => (haystack.includes(token) ? sum + 2 : sum), 0);
            return { product, score };
          })
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map((entry) => entry.product);

        contextData.relatedProducts = scored;
        dataPayload = {
          type: 'related_products',
          summary: { requirement },
          items: scored,
        };
      }
    } catch (err) {
      logger.warn('Failed to gather AI context data', { error: err });
    }

    try {
      const prompt = `${ADMIN_REPORT_HINT}\n\nUser query: ${rawQuery}\n\nData:\n${JSON.stringify(contextData, null, 2)}\n\nProvide a short response using only the data above.`;
      const answer = await generateGeminiText({ prompt, temperature: 0.3, maxOutputTokens: 350 });
      return NextResponse.json({ answer, data: dataPayload });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Gemini AI Service Error', { error: message });
      return NextResponse.json({
        answer: 'AI service is temporarily unavailable. Please try again later.',
        data: dataPayload,
        error: message,
      });
    }

  } catch (error) {
    logger.error('AI Query Error', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
