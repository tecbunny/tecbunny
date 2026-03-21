import { NextRequest, NextResponse } from 'next/server'

import { sendSms } from '../../../../lib/sms/twofactor'
import { rateLimit } from '../../../../lib/rate-limit'

// export const dynamic = 'force-dynamic'

function authorized(req: NextRequest) {
  // Basic protection: require internal token in header for server-to-server
  const token = process.env.INTERNAL_API_TOKEN
  const hdr = req.headers.get('x-internal-token')
  return !!token && token === hdr
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { to, message, vars, flowId, useFlowFirst } = await req.json().catch(() => ({}))
  if (!to) return NextResponse.json({ error: 'Missing to' }, { status: 400 })
  const mobiles = Array.isArray(to) ? to : String(to).split(',').map((s: string) => s.trim()).filter(Boolean)
  if (mobiles.length === 0) return NextResponse.json({ error: 'No valid recipients' }, { status: 400 })

  // Rate limit by IP and by recipient to avoid abuse
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const rlKey = `sms:${ip}`
  const rl = await rateLimit(rlKey, 10, 60_000) // 10 requests per minute per IP
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  const result = await sendSms({ to: mobiles.join(','), message, vars, flowId, useFlowFirst })
  if (!result.success) {
    return NextResponse.json({ error: result.error, raw: result.raw }, { status: result.status || 500 })
  }
  return NextResponse.json({ success: true, id: result.id, raw: result.raw })
}
