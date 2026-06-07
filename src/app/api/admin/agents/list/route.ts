import { NextResponse } from 'next/server'

import { AdminAuthError, requireAdminContext } from '@/lib/auth/admin-guard'

// export const dynamic = 'force-dynamic'

// GET /api/admin/agents/list?status=pending|approved
export async function GET(request: Request) {
  let context
  try {
    context = await requireAdminContext()
  } catch (error) {
    const statusCode = error instanceof AdminAuthError ? error.status : 401
    return NextResponse.json({ error: 'Unauthorized' }, { status: statusCode })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || undefined
  const supabase = context.serviceSupabase
  let query = supabase.from('sales_agents').select('*')
  if (status) query = query.eq('status', status)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ agents: data || [] })
}
