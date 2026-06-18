import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { requireSupabasePublicEnv } from '@/lib/supabase/env'

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true })
    const { url, publicKey } = requireSupabasePublicEnv()
    
    const supabase = createServerClient(
      url,
      publicKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // Sign out the user
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      logger.error('auth.signout_api.signout_failed', { error })
      return NextResponse.json({ error: 'Signout failed' }, { status: 500 })
    }

    logger.info('auth.signout_api.success')
    
    // Clear any additional cookies that might exist
    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')
    response.cookies.delete('superadmin-session')

    // SECURITY: Force browser to clear sensitive data on signout
    response.headers.set('Clear-Site-Data', '"cookies", "storage", "cache"')
    
    return response
  } catch (error) {
    logger.error('auth.signout_api.error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
