import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase/server'

// export const dynamic = 'force-dynamic'

// POST /api/admin/redemptions/approve { redemption_id }
export async function POST(request: Request) {
  const token = process.env.INTERNAL_API_TOKEN
  const provided = request.headers.get('x-internal-token') || ''
  if (!token || provided !== token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { redemption_id } = await request.json().catch(() => ({}))
  if (!redemption_id) return NextResponse.json({ error: 'redemption_id required' }, { status: 400 })

  const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient()
  const { error } = await supabase
    .from('agent_redemption_requests')
    .update({ status: 'approved' })
    .eq('id', redemption_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
