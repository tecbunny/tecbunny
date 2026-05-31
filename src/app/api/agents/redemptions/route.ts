import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// export const dynamic = 'force-dynamic'

// GET /api/agents/redemptions - list current agent's redemption requests
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  // Find agent id
  const { data: agent, error: aErr } = await supabase
    .from('sales_agents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 })
  if (!agent) return NextResponse.json({ redemptions: [] })

  const { data, error } = await supabase
    .from('agent_redemption_requests')
    .select('*')
    .eq('agent_id', agent.id)
    .order('requested_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ redemptions: data || [] })
}

// POST /api/agents/redemptions - create a redemption request
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const points = Number(body?.points || body?.points_to_redeem)
  const bank_details = body?.bank_details ?? null
  const notes = body?.notes ?? null

  if (!Number.isFinite(points) || points <= 0) {
    return NextResponse.json({ error: 'Invalid points' }, { status: 400 })
  }

  // Resolve agent
  const { data: agent, error: aErr } = await supabase
    .from('sales_agents')
    .select('id, points_balance, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 })
  if (!agent) return NextResponse.json({ error: 'Not a sales agent' }, { status: 403 })
  if (agent.status !== 'approved') return NextResponse.json({ error: 'Agent not approved' }, { status: 403 })
  if (Number(agent.points_balance) < points) return NextResponse.json({ error: 'Insufficient points' }, { status: 400 })

  const { data, error } = await supabase
    .from('agent_redemption_requests')
    .insert({ agent_id: agent.id, points_to_redeem: points, bank_details, notes })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, redemption: data })
}
