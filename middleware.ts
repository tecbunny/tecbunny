import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Staff roles that are permitted to access the CRM subdomain
const CRM_STAFF_ROLES = new Set(['admin', 'manager', 'sales', 'service_engineer', 'accounts'])

export async function middleware(request: NextRequest) {
  // Define public API routes that don't require authentication
  // Note: Maintain this list carefully. All other /api/* routes will be protected by default (Fail-Closed).
  const publicApiRoutes = [
    '/api/auth',     // Auth endpoints (signin, callback, etc)
    '/api/settings',
    '/api/page-content',
    '/api/auto-offers',
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
  const hostname = request.headers.get('host') || ''
  const isCrmSubdomain = hostname === 'crm.tecbunny.com' || hostname.startsWith('crm.')

  let response = NextResponse.next({ request: { headers: requestHeaders } })

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

      // On CRM subdomain, also fetch role for access gating
      if (isCrmSubdomain && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        userRole = profile?.role ?? null
      }
    } catch (e) {
      // If Supabase fails, we proceed with user = null
      console.error('Middleware Supabase Error:', e);
    }
  }

  // ─── CRM SUBDOMAIN (crm.tecbunny.com) ───────────────────────────────────────
  // This subdomain serves the admin/staff panel ONLY.
  // Any public-facing page is off-limits — redirect it to www.tecbunny.com.
  if (isCrmSubdomain) {
    const isStaffLoginPath = pathname.startsWith('/auth/staff-signin')
    const isAuthPath       = pathname.startsWith('/auth/callback') || pathname.startsWith('/auth/signout')
    const isApiPath        = pathname.startsWith('/api/')
    const isManagementPath = pathname.startsWith('/management')
    const isNextInternal   = pathname.startsWith('/_next') || pathname.startsWith('/favicon')
    const isRoot           = pathname === '/'

    // Root → redirect to management (middleware will then enforce auth)
    if (isRoot) {
      return NextResponse.redirect(new URL('/management', request.url))
    }

    // Allow: staff login, auth callbacks, signout, API, management panel, Next internals
    const isCrmAllowed = isStaffLoginPath || isAuthPath || isApiPath || isManagementPath || isNextInternal

    if (!isCrmAllowed) {
      // Any other public page (/products, /services, /about, etc.) → redirect to main site
      return NextResponse.redirect(new URL(`https://www.tecbunny.com${pathname}`, request.url))
    }

    // Management panel paths: enforce authentication
    if (!isApiPath && !isStaffLoginPath && !isAuthPath) {
      if (!user) {
        const loginUrl = new URL('/auth/staff-signin', request.url)
        loginUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(loginUrl)
      }
      if (userRole && !CRM_STAFF_ROLES.has(userRole)) {
        // Authenticated but not staff → show denied
        return NextResponse.redirect(new URL('/auth/staff-signin?denied=1', request.url))
      }
    }
  }

  // SECURITY: Fail-Closed API Protection
  // If we are hitting an API route, and it is NOT explicitly public, require a user.
  if (pathname.startsWith('/api')) {
    if (!isPublicApiRoute && !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required for this endpoint' },
        { status: 401 }
      )
    }
  }

  // Protect Management Routes (on main domain, middleware redirects to CRM subdomain via vercel.json)
  if (pathname.startsWith('/management') && !user) {
    return NextResponse.redirect(new URL('/auth/staff-signin', request.url))
  }

  const applySharedHeaders = () => {
    // Add cache-control headers to prevent caching of auth-related pages
    if (pathname.startsWith('/management') || pathname.startsWith('/auth')) {
      response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }

    if (
      pathname.startsWith('/management') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/checkout') ||
      pathname.startsWith('/cart') ||
      pathname.startsWith('/profile')
    ) {
      response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    }

    // Global security headers (basic hardening)
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    // Minimal CSP (can be expanded later)
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: https:",
      // Allow Cloudflare Turnstile scripts and analytics beacon
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.cloudflareinsights.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      // Allow API calls to any https, Turnstile verification, and analytics beacon uploads
      "connect-src 'self' https: https://*.cloudflareinsights.com https://static.cloudflareinsights.com",
      "font-src 'self' data:",
      // Permit Turnstile widget iframe
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'self'",
      "object-src 'none'",
    ].join('; ')
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('X-Correlation-Id', correlationId)

    return response
  }

  return applySharedHeaders()
}

  const applySharedHeaders = () => {
    // Add cache-control headers to prevent caching of auth-related pages
    if (pathname.startsWith('/management') || pathname.startsWith('/auth')) {
      response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }

    if (
      pathname.startsWith('/management') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/checkout') ||
      pathname.startsWith('/cart') ||
      pathname.startsWith('/profile')
    ) {
      response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    }

    // Global security headers (basic hardening)
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    // Minimal CSP (can be expanded later)
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: https:",
      // Allow Cloudflare Turnstile scripts and analytics beacon
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.cloudflareinsights.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      // Allow API calls to any https, Turnstile verification, and analytics beacon uploads
      "connect-src 'self' https: https://*.cloudflareinsights.com https://static.cloudflareinsights.com",
      "font-src 'self' data:",
      // Permit Turnstile widget iframe
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'self'",
      "object-src 'none'",
    ].join('; ')
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('X-Correlation-Id', correlationId)

    return response
  }

  return applySharedHeaders()
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
