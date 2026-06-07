import { NextResponse } from 'next/server'

import { AdminAuthError, requireAdminContext } from '@/lib/auth/admin-guard'

// export const dynamic = 'force-dynamic'

// POST /api/admin/agents/approve { agent_id }
export async function POST(request: Request) {
  let context
  try {
    context = await requireAdminContext()
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 401
    return NextResponse.json({ error: 'Unauthorized' }, { status })
  }

  const { agent_id } = await request.json().catch(() => ({}))
  if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

  const supabase = context.serviceSupabase
  const { error } = await supabase
    .from('sales_agents')
    .update({ status: 'approved' })
    .eq('id', agent_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
