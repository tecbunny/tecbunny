import { NextResponse } from 'next/server'

import { AdminAuthError, requireAdminContext } from '@/lib/auth/admin-guard'

// export const dynamic = 'force-dynamic'

// POST /api/admin/redemptions/approve { redemption_id }
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
  const { error } = await supabase
    .from('agent_redemption_requests')
    .update({ status: 'approved' })
    .eq('id', redemption_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
