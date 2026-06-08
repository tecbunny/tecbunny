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
// Body: { customer: { email|mobile, name? }, items: OrderItem[], notes?, type? }
export async function POST(request: Request) {
  const anon = await createClient()
  const svc = isSupabaseServiceConfigured ? createServiceClient() : await createClient()

  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  // Ensure caller is an approved sales agent
  const { data: agent, error: agentErr } = await anon
    .from('sales_agents')
    .select('id,status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (agentErr) return NextResponse.json({ error: agentErr.message }, { status: 400 })
  if (!agent || agent.status !== 'approved') {
    return NextResponse.json({ error: 'Only approved sales agents can create orders' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const customer: CustomerInput = body?.customer || {}
  const items: OrderItem[] = Array.isArray(body?.items) ? body.items : []
  const notes: string | undefined = body?.notes
  const type: string = body?.type || 'Delivery'

  if ((!customer.email && !customer.mobile) || items.length === 0) {
    return NextResponse.json({ error: 'Provide customer email or mobile and at least one item' }, { status: 400 })
  }

  // Resolve or create customer user
  const customerId = await ensureCustomerUser(svc, customer)
  if (!customerId) {
    return NextResponse.json({ error: 'Failed to resolve customer' }, { status: 500 })
  }

  // Compute totals
  const totals = computeTotals(items)

  const atomicItems = items.map((item) => ({
    ...item,
    id: item.productId,
  }))

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
    p_agent_id: agent.id,
  })

  if (atomicOrderError) {
    return NextResponse.json(
      { error: 'Failed to create order with reserved inventory', details: atomicOrderError.message },
      { status: 409 }
    )
  }

  const atomicOrderId = (atomicOrder as any)?.order?.id
  if (!atomicOrderId) {
    return NextResponse.json({ error: 'Atomic order creation returned no order id' }, { status: 500 })
  }

  await svc
    .from('orders')
    .update({ agent_id: agent.id })
    .eq('id', atomicOrderId)

  await awardCommissionForAgent(svc, agent.id as string, atomicOrderId, totals.total).catch(() => {})

  return NextResponse.json({ success: true, order_id: atomicOrderId })
}

async function ensureCustomerUser(svc: ReturnType<typeof createServiceClient>, c: CustomerInput): Promise<string | null> {
  // Normalize mobile if provided
  const normalizedMobile = c.mobile ? c.mobile.replace(/\D/g, '') : null;
  const mobileWithPrefix = normalizedMobile ? (normalizedMobile.startsWith('91') && normalizedMobile.length === 12 ? normalizedMobile : (normalizedMobile.length === 10 ? `91${normalizedMobile}` : normalizedMobile)) : null;

  // 1) Try find by email or mobile in profiles
  const supabase = svc
  let profile: any = null

  if (c.email) {
    const { data } = await supabase.from('profiles').select('id').eq('email', c.email.trim().toLowerCase()).maybeSingle()
    if (data) profile = data
  }
  if (!profile && mobileWithPrefix) {
    const { data } = await supabase.from('profiles').select('id').eq('mobile', mobileWithPrefix).maybeSingle()
    if (data) profile = data
  }
  if (profile?.id) return profile.id

  // 2) Create auth user via admin API
  const createReq: any = {
    email: c.email ? c.email.trim().toLowerCase() : undefined,
    phone: mobileWithPrefix || undefined,
    email_confirm: true,
    phone_confirm: !!mobileWithPrefix,
    user_metadata: { name: c.name, mobile: mobileWithPrefix }
  }
  const { data: created, error } = await supabase.auth.admin.createUser(createReq)
  if (error || !created?.user) return null

  const newUserId = created.user.id as string
  // 3) Upsert profile
  await supabase
    .from('profiles')
    .upsert({ id: newUserId, name: c.name || '', email: c.email ? c.email.trim().toLowerCase() : null, mobile: mobileWithPrefix, role: 'customer' })

  return newUserId
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

