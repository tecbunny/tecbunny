import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase/server'

// export const dynamic = 'force-dynamic'

// POST /api/admin/agents/reject { agent_id }
export async function POST(request: Request) {
  const token = process.env.INTERNAL_API_TOKEN
  const provided = request.headers.get('x-internal-token') || ''
  if (!token || provided !== token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agent_id } = await request.json().catch(() => ({}))
  if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

  const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient()
  const { error } = await supabase
    .from('sales_agents')
    .update({ status: 'rejected' })
    .eq('id', agent_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
