import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// export const dynamic = 'force-dynamic'

// GET /api/agents/me - current user's agent profile
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { data, error } = await supabase
    .from('sales_agents')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ agent: data })
}
