import { NextResponse } from 'next/server'

import { AdminAuthError, requireAdminContext } from '@/lib/auth/admin-guard'

// export const dynamic = 'force-dynamic'

// POST /api/admin/redemptions/process { redemption_id }
export async function POST(request: Request) {
  let context
  try {
    context = await requireAdminContext()
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 401
    return NextResponse.json({ error: 'Unauthorized' }, { status })
  }

  const { redemption_id } = await request.json().catch(() => ({}))
  if (!redemption_id) return NextResponse.json({ error: 'redemption_id required' }, { status: 400 })

  const supabase = context.serviceSupabase

  // Fetch redemption
  const { data: red, error: rErr } = await supabase
    .from('agent_redemption_requests')
    .select('id, agent_id, points_to_redeem, status')
    .eq('id', redemption_id)
    .single()

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 })
  if (!red) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (red.status !== 'approved') return NextResponse.json({ error: 'Redemption must be approved first' }, { status: 400 })

  // Decrement points and mark processed
  const { error: balErr } = await supabase.rpc('increment_agent_points', {
    agent_id: red.agent_id,
    points_to_add: -Number(red.points_to_redeem)
  })
  if (balErr) return NextResponse.json({ error: balErr.message }, { status: 400 })

  const { error: updErr } = await supabase
    .from('agent_redemption_requests')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', redemption_id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
