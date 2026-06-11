import { NextResponse } from 'next/server'

import { createClient, createServiceClient , isSupabaseServiceConfigured } from '@/lib/supabase/server'

// export const dynamic = 'force-dynamic'

type OrderItem = {
  productId: string
  quantity: number
  price: number
  name?: string
  gstRate?: number
  hsnCode?: string
  serialNumbers?: string[]
}

type CustomerInput = {
  email?: string
  mobile?: string
  name?: string
}

function computeTotals(items: OrderItem[]) {
  let subtotal = 0
  let total = 0
  for (const it of items) {
    total += it.price * it.quantity
    const rate = it.gstRate ?? 0
    const base = it.price / (1 + rate / 100)
    subtotal += base * it.quantity
  }
  const gst_amount = Math.max(0, total - subtotal)
  return { subtotal: round2(subtotal), total: round2(total), gst_amount: round2(gst_amount) }
}

function round2(n: number) { return Math.round(n * 100) / 100 }

// POST /api/agents/orders/create
// Body: { customer: { email|mobile, name? }, items: OrderItem[], notes?, type?, referralCode?, configPayload? }
export async function POST(request: Request) {
  const anon = await createClient()
  const svc = isSupabaseServiceConfigured ? createServiceClient() : await createClient()
  const body = await request.json().catch(() => ({}))
  
  const referralCode: string | undefined = body?.referralCode
  const configPayload: any = body?.configPayload

  let agentId: string | null = null;
  let user = null;

  // 1. Resolve Attribution Context (Auth or Referral)
  if (referralCode) {
    // Lead coming from Embedded Widget
    const { data: refAgent, error: refError } = await svc
      .from('sales_agents')
      .select('id, status, user_id, profiles:user_id(name, mobile)')
      .eq('referral_code', referralCode)
      .single();

    if (refError || !refAgent || refAgent.status !== 'approved') {
      return NextResponse.json({ error: 'Invalid or inactive referral context' }, { status: 403 });
    }
    agentId = refAgent.id;
    // For widget leads, we don't necessarily have a logged-in agent user
    // We attach the lead to refAgent.id
  } else {
    // Traditional Agent Dashboard Creation (Requires Auth)
    const { data: { user: authUser } } = await anon.auth.getUser()
    user = authUser;
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: authAgent, error: authAgentErr } = await anon
      .from('sales_agents')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (authAgentErr || !authAgent || authAgent.status !== 'approved') {
      return NextResponse.json({ error: 'Approved agent context required' }, { status: 403 });
    }
    agentId = authAgent.id;
  }

  const customer: CustomerInput = body?.customer || {}
  const items: OrderItem[] = Array.isArray(body?.items) ? body.items : []
  const notes: string | undefined = body?.notes
  const type: string = body?.type || 'Delivery'

  // If it's a widget lead (configPayload exists), we might not have 'items' yet, just a 'Setup' type
  const isWidgetLead = !!configPayload;

  if (!isWidgetLead && ((!customer.email && !customer.mobile) || items.length === 0)) {
    return NextResponse.json({ error: 'Provide customer email or mobile and at least one item' }, { status: 400 })
  }

  // 2. High-Tier Enterprise Lead Detection & WhatsApp Notification
  if (isWidgetLead && configPayload) {
    const isHighTier = configPayload.cameraCount >= 16 || configPayload.systemType?.includes('IP');
    
    if (isHighTier) {
      try {
        const { WhatsAppService } = await import('@/lib/whatsapp-service');
        const { logger } = await import('@/lib/logger');
        const whatsapp = new WhatsAppService();

        // Fetch agent info for notification if not already in memory
        const { data: agentData } = await svc
          .from('sales_agents')
          .select('profiles:user_id(name, mobile)')
          .eq('id', agentId)
          .single();

        const agentProfile = agentData?.profiles as any;
        
        if (agentProfile?.mobile) {
          await whatsapp.sendMessage(agentProfile.mobile, `🚀 *NEW HIGH-TIER LEAD* \n\nCustomer: ${customer.name || 'Inquiry'}\nConfig: ${configPayload.cameraCount}x Nodes\nCheck your dashboard for details.`);
        }

        const INSIDE_SALES_LINE = process.env.INSIDE_SALES_WHATSAPP || '919604136010';
        await whatsapp.sendMessage(INSIDE_SALES_LINE, `🔥 *URGENT ENTERPRISE LEAD* \n\nAgent: ${agentProfile?.name || 'Widget'}\nCustomer: ${customer.name || 'Inquiry'} (${customer.mobile || 'No Phone'})\nPriority: Immediate outreach.`);
        
      } catch (err) {
        console.error('Lead notification trigger failed', err);
      }
    }
  }

  // Handle lead creation or full order
  let result;
  if (isWidgetLead) {
    // Create as a lead/order in 'Pending' status
    const { data: lead, error: leadError } = await svc
      .from('orders')
      .insert([{
        customer_name: customer.name || 'Web Lead',
        customer_phone: customer.mobile || null,
        customer_email: customer.email || null,
        status: 'Pending',
        type: 'Setup',
        agent_id: agentId,
        notes: `EMBEDDED_WIDGET | Config: ${JSON.stringify(configPayload)} | ${notes || ''}`,
        subtotal: 0,
        total: 0,
        gst_amount: 0
      }])
      .select()
      .single();
    
    if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
    result = lead;
  } else {
    // Existing logic for full order creation
    const customerId = await ensureCustomerUser(svc, customer)
    if (!customerId) return NextResponse.json({ error: 'Failed to resolve customer' }, { status: 500 })

    const totals = computeTotals(items)
    const atomicItems = items.map((item) => ({ ...item, id: item.productId }))

    const { data: atomicOrder, error: atomicOrderError } = await svc.rpc('allocate_order_inventory_atomic', {
      p_customer_name: customer.name || customer.email || customer.mobile || 'Customer',
      p_customer_id: customerId,
      p_customer_email: customer.email || null,
      p_customer_phone: customer.mobile || null,
      p_delivery_address: null,
      p_notes: notes || null,
      p_payment_method: null,
      p_subtotal: totals.subtotal,
      p_gst_amount: totals.gst_amount,
      p_total: totals.total,
      p_discount_amount: 0,
      p_shipping_amount: 0,
      p_payment_status: 'pending',
      p_order_type: type,
      p_items: atomicItems,
      p_agent_id: agentId,
    })

    if (atomicOrderError) return NextResponse.json({ error: atomicOrderError.message }, { status: 400 })
    result = atomicOrder;

    // 3. Award Commission for Full Orders
    const atomicOrderId = (result as any)?.order?.id
    if (atomicOrderId && agentId) {
      await awardCommissionForAgent(svc, agentId, atomicOrderId, totals.total).catch(() => {})
    }
  }

  const response = NextResponse.json({ 
    success: true, 
    order: result,
    redirectUrl: isWidgetLead ? `/commerce/setup/confirmation?id=${result.id}&ref=${referralCode}` : undefined
  })

  if (referralCode) {
    response.cookies.set('tecbunny_attribution', referralCode, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
      secure: true,
      sameSite: 'lax'
    });
  }

  return response
}

async function ensureCustomerUser(svc: ReturnType<typeof createServiceClient>, c: CustomerInput): Promise<string | null> {
  const normalizedMobile = c.mobile ? c.mobile.replace(/\D/g, '') : null;
  const mobileWithPrefix = normalizedMobile ? (normalizedMobile.startsWith('91') && normalizedMobile.length === 12 ? normalizedMobile : (normalizedMobile.length === 10 ? `91${normalizedMobile}` : normalizedMobile)) : null;
  const email = c.email ? c.email.trim().toLowerCase() : undefined;

  // 1) Try creating the user immediately. This prevents the classic "read then create" race condition.
  const createReq: any = {
    email: email,
    phone: mobileWithPrefix || undefined,
    email_confirm: true,
    phone_confirm: !!mobileWithPrefix,
    user_metadata: { name: c.name, mobile: mobileWithPrefix }
  };
  
  const { data: created, error } = await svc.auth.admin.createUser(createReq);

  let userId: string | null = created?.user?.id || null;

  // 2) If the user already exists, find their ID with a single targeted query
  if (!userId && error) {
    const query = svc.from('profiles').select('id');
    if (email && mobileWithPrefix) {
      query.or(`email.eq.${email},mobile.eq.${mobileWithPrefix}`);
    } else if (email) {
      query.eq('email', email);
    } else if (mobileWithPrefix) {
      query.eq('mobile', mobileWithPrefix);
    }
    const { data } = await query.limit(1).maybeSingle();
    if (data?.id) userId = data.id;
  }

  if (!userId) return null;

  // 3) Atomic UPSERT on profiles
  await svc
    .from('profiles')
    .upsert(
      { id: userId, name: c.name || '', email: email || null, mobile: mobileWithPrefix, role: 'customer' },
      { onConflict: 'id', ignoreDuplicates: false }
    );

  return userId;
}

async function awardCommissionForAgent(
  svc: ReturnType<typeof createServiceClient>,
  agentId: string,
  orderId: string,
  orderTotal: number
) {
  // Read commission config
  const { data: settings } = await svc
    .from('settings')
    .select('value')
    .eq('key', 'sales_agent_commission')
    .maybeSingle()

  const cfg = (settings?.value || { type: 'fixed_per_rupee', value: 1.0 }) as { type: string; value: number }
  let points = 0
  if (cfg.type === 'fixed_per_rupee') points = orderTotal * cfg.value
  else if (cfg.type === 'percentage') points = (orderTotal * cfg.value) / 100
  points = Math.round(points * 100) / 100

  // Insert commission record
  await svc.from('sales_agent_commissions').insert({
    agent_id: agentId,
    order_id: orderId,
    order_total: orderTotal,
    commission_rate_snapshot: cfg,
    points_awarded: points,
  })

  // Increment agent balance
  await svc.rpc('increment_agent_points', { agent_id: agentId, points_to_add: points })
}

