import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Staff roles that are permitted to access the CRM subdomain
const CRM_STAFF_ROLES = new Set(['superadmin', 'admin', 'manager', 'sales', 'service_engineer', 'accounts'])

const SHARED_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://cs.iubenda.com https://cdn.iubenda.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://region1.analytics.google.com https://cloudflareinsights.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com https://www.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

export async function middleware(request: NextRequest) {
  // Define public API routes that don't require authentication
  // Note: Maintain this list carefully. All other /api/* routes will be protected by default (Fail-Closed).
  const publicApiRoutes = [
    '/api/auth',     // Auth endpoints (signin, callback, etc)
    '/api/health',
    '/api/settings',
    '/api/page-content',
    '/api/auto-offers',
    '/api/offers',
    '/api/coupons',
    '/api/products', // Public product catalog
    '/api/analytics', // Public analytics tracking
    '/api/captcha',  // Public captcha config/verification
  ]
  
  // Check if the current path is in the public API routes
  const isPublicApiRoute = publicApiRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  const requestHeaders = new Headers(request.headers)
  // Correlation ID
  let correlationId = requestHeaders.get('x-correlation-id') || crypto.randomUUID()
  requestHeaders.set('x-correlation-id', correlationId)

  const pathname = request.nextUrl.pathname

  // Superadmin session validation via Edge Runtime Web Crypto
  const superadminCookie = request.cookies.get('superadmin-session')?.value
  let isSuperadmin = false
  if (superadminCookie) {
    const correctEmail = process.env.SUPERADMIN_EMAIL
    const correctPassword = process.env.SUPERADMIN_PASSWORD
    if (correctEmail && correctPassword) {
      const secret = process.env.SUPERADMIN_PASSWORD || 'superadmin_salt_key_default'
      const msgBuffer = new TextEncoder().encode(`${correctEmail}:${correctPassword}:${secret}`)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const expectedToken = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      isSuperadmin = (superadminCookie === expectedToken)
    }
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const finalizeResponse = (res: NextResponse) => {
    if (res !== response) {
      response.cookies.getAll().forEach((cookie) => {
        res.cookies.set(cookie)
      })
    }

    if (pathname.startsWith('/mgmt') || pathname.startsWith('/auth')) {
      res.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
      res.headers.set('Pragma', 'no-cache')
      res.headers.set('Expires', '0')
    }

    if (
      pathname.startsWith('/mgmt') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/checkout') ||
      pathname.startsWith('/cart') ||
      pathname.startsWith('/profile') ||
      pathname.startsWith('/superadmin') ||
      pathname.startsWith('/api/superadmin')
    ) {
      res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    }

    res.headers.set('X-Frame-Options', 'DENY')
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    res.headers.set('Content-Security-Policy', SHARED_CONTENT_SECURITY_POLICY)
    res.headers.set('X-Correlation-Id', correlationId)

    return res
  }

  // Supabase Auth & Session Management - Safe initialization
  let user = null;
  let userRole: string | null = null;
  
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options)
              })
            },
          },
        }
      )

      // Refresh session if expired
      const { data } = await supabase.auth.getUser()
      user = data.user

      if (user) {
        // Try getting role from app_metadata first
        const rawRole = user.app_metadata?.role;
        if (rawRole && typeof rawRole === 'string') {
          const norm = rawRole.trim().toLowerCase();
          userRole = norm === 'superadmin' || norm === 'super-admin' || norm === 'super admin' ? 'superadmin' : norm;
        }

        // Fallback to database for Management or Superadmin paths
        const needsRoleLookup = !userRole || pathname.startsWith('/mgmt') || pathname.startsWith('/api/mgmt') || pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin');
        if (needsRoleLookup) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role && typeof profile.role === 'string') {
            const norm = profile.role.trim().toLowerCase();
            userRole = norm === 'superadmin' || norm === 'super-admin' || norm === 'super admin' ? 'superadmin' : norm;
          }
        }
      }
    } catch (e) {
      // If Supabase fails, we proceed with user = null
      console.error('Middleware Supabase Error:', e);
    }
  }

  // ─── SUPERADMIN PATH PROTECTIONS ───────────────────────────────────────────
  if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
    const isLoginRoute = pathname === '/superadmin/login' || pathname === '/api/superadmin/login'
    if (!isLoginRoute && !isSuperadmin) {
      if (pathname.startsWith('/api/')) {
        return finalizeResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      }
      return finalizeResponse(NextResponse.redirect(new URL('/staff/login', request.url)))
    }
  }

  // SECURITY: Fail-Closed API Protection
  // If we are hitting an API route, and it is NOT explicitly public, require a user.
  if (pathname.startsWith('/api')) {
    if (!isPublicApiRoute && !user) {
      return finalizeResponse(NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required for this endpoint' },
        { status: 401 }
      ))
    }
  }

  // Protect Management Routes
  if (pathname.startsWith('/mgmt')) {
    if (!user) {
      const loginUrl = new URL('/staff/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return finalizeResponse(NextResponse.redirect(loginUrl))
    }
    
    // Check if the user is a staff/worker role
    if (!userRole || !CRM_STAFF_ROLES.has(userRole)) {
      return finalizeResponse(NextResponse.rewrite(new URL('/404', request.url)))
    }
  }

  return finalizeResponse(response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
