import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// export const dynamic = 'force-dynamic'

// GET /api/agents/commissions - list current agent's commissions
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
  if (!agent) return NextResponse.json({ commissions: [] })

  const { data, error } = await supabase
    .from('sales_agent_commissions')
    .select('*')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ commissions: data || [] })
}
