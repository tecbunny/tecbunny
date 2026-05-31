import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase/server'

// export const dynamic = 'force-dynamic'

// GET /api/admin/agents/list?status=pending|approved
export async function GET(request: Request) {
  const token = process.env.INTERNAL_API_TOKEN
  const provided = new Headers(request.headers).get('x-internal-token') || ''
  if (!token || provided !== token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || undefined
  const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient()
  let query = supabase.from('sales_agents').select('*')
  if (status) query = query.eq('status', status)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ agents: data || [] })
}
