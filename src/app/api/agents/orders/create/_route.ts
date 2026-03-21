import { NextResponse } from 'next/server'

import { createClient, createServiceClient } from '../../../../../lib/supabase/server'

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
  const svc = createServiceClient()

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

  // Create order for the customer, and attribute to agent
  const orderNumber = genOrderNumber()
  const modernPayload = {
    order_number: orderNumber,
    user_id: customerId,
    status: 'Pending',
    subtotal: totals.subtotal,
    tax_amount: totals.gst_amount,
    shipping_amount: 0,
    total: totals.total,
    total_amount: totals.total,
    currency: 'INR',
    payment_method: null as any,
    shipping_address: null as any,
    billing_address: null as any,
    items,
    notes,
    agent_id: agent.id
  }

  let createdOrderId: string | null = null
  let orderTotalForCommission = totals.total

  // Try modern schema
  {
    const { data, error } = await svc
      .from('orders')
      .insert(modernPayload)
      .select('id, total')
      .maybeSingle()
    if (!error && data) {
      createdOrderId = data.id
      orderTotalForCommission = Number(data.total ?? totals.total)
    }
  }

  // Fallback: legacy schema with customer_name/total/gst_amount/etc.
  if (!createdOrderId) {
    const legacyPayload: any = {
      customer_name: customer.name || customer.email || customer.mobile || 'Customer',
      customer_id: customerId,
      status: 'Pending',
      subtotal: totals.subtotal,
      gst_amount: totals.gst_amount,
      total: totals.total,
      type,
      items,
      notes,
      processed_by: user.id,
      agent_id: agent.id
    }
    // Attempt with agent_id
    let { data, error } = await svc
      .from('orders')
      .insert(legacyPayload)
      .select('id, total')
      .maybeSingle()
    if (error) {
      // Retry without agent_id if undefined column
      delete legacyPayload.agent_id
      const retry = await svc
        .from('orders')
        .insert(legacyPayload)
        .select('id, total')
        .maybeSingle()
      data = retry.data
      error = retry.error
    }
    if (data) {
      createdOrderId = data.id
      orderTotalForCommission = Number((data as any).total ?? totals.total)
    } else if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create order' }, { status: 400 })
    }
  }

  if (!createdOrderId) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 400 })
  }

  // Adjust inventory (best-effort; does not fail the order)
  await adjustInventory(svc, items).catch(() => {})

  // Award commission points for the agent based on settings
  await awardCommissionForAgent(svc, agent.id as string, createdOrderId, orderTotalForCommission).catch(() => {})

  return NextResponse.json({ success: true, order_id: createdOrderId })
}

async function ensureCustomerUser(svc: ReturnType<typeof createServiceClient>, c: CustomerInput): Promise<string | null> {
  // 1) Try find by email or mobile in profiles
  const supabase = svc
  let profile: any = null

  if (c.email) {
    const { data } = await supabase.from('profiles').select('id').eq('email', c.email).maybeSingle()
    if (data) profile = data
  }
  if (!profile && c.mobile) {
    const { data } = await supabase.from('profiles').select('id').eq('mobile', c.mobile).maybeSingle()
    if (data) profile = data
  }
  if (profile?.id) return profile.id

  // 2) Create auth user via admin API
  const createReq: any = {
    email: c.email || undefined,
    phone: c.mobile || undefined,
    email_confirm: true,
    phone_confirm: !!c.mobile,
    user_metadata: { name: c.name, mobile: c.mobile }
  }
  const { data: created, error } = await supabase.auth.admin.createUser(createReq)
  if (error || !created?.user) return null

  const newUserId = created.user.id as string
  // 3) Upsert profile
  await supabase
    .from('profiles')
    .upsert({ id: newUserId, name: c.name || '', email: c.email || null, mobile: c.mobile || null, role: 'customer' })

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

function genOrderNumber(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const t = d.getTime().toString().slice(-6)
  return `TB-${y}${m}${day}-${t}`
}

async function adjustInventory(
  svc: ReturnType<typeof createServiceClient>,
  items: Array<{ productId: string; quantity: number }>
) {
  for (const it of items) {
    const pid = it.productId
    const qty = Math.max(1, Number(it.quantity) || 1)
    // 1) Try stock movement RPC
    const rpc = await svc.rpc('record_stock_movement', {
      p_product_id: pid,
      p_movement_type: 'out',
      p_quantity: qty,
      p_reference_type: 'agent_order',
      p_notes: 'Agent order deduction'
    })
    if (!rpc.error) continue

    // 2) Fallback to inventory table
    const { data: inv } = await svc
      .from('inventory')
      .select('quantity')
      .eq('product_id', pid)
      .maybeSingle()
    const current = Number(inv?.quantity ?? 0)
    const newQty = Math.max(0, current - qty)
    await svc
      .from('inventory')
      .upsert({ product_id: pid, quantity: newQty, last_updated: new Date().toISOString() }, { onConflict: 'product_id' })
    // Try to record movement if table exists
    try {
      await svc
        .from('stock_movements')
        .insert({ product_id: pid, movement_type: 'out', quantity: qty, reference_type: 'agent_order', notes: 'Agent order deduction (fallback)' })
    } catch (_) {
      // ignore
    }

    // 3) Update products stock columns for UI consistency
    await svc
      .from('products')
      .update({ stock_quantity: newQty, quantity: newQty })
      .eq('id', pid)
  }
}
