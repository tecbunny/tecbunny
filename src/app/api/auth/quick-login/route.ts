import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// export const dynamic = 'force-dynamic'

function quickLoginEnabled() {
  if (process.env.NODE_ENV !== 'production') return true
  return process.env.QUICK_LOGIN_ENABLED === 'true'
}

export async function POST(request: Request) {
  if (!quickLoginEnabled()) {
    return NextResponse.json({ error: 'Quick login disabled' }, { status: 403 })
  }

  const form = await request.formData()
  const email = String(form.get('email') || '')
  const redirect = String(form.get('redirect') || '/')
  const password = process.env.QUICK_LOGIN_PASSWORD || 'Password123!'

  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  // On success, redirect to the requested page. Cookies are set by SSR client.
  try {
    const redirectUrl = new URL(redirect, request.url)
    return NextResponse.redirect(redirectUrl, { status: 303 })
  } catch {
    return NextResponse.redirect(new URL('/', request.url), { status: 303 })
  }
}
