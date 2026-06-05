import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
    const correctEmail = process.env.SUPERADMIN_USER_ID
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

  // Trace Superadmin claims and lock out from client storefront and standard mgmt pages (redirect to dashboard)
  if (isSuperadmin) {
    if (
      pathname.startsWith('/profile') ||
      pathname.startsWith('/cart') ||
      pathname.startsWith('/checkout') ||
      pathname.startsWith('/mgmt')
    ) {
      return finalizeResponse(NextResponse.redirect(new URL('/superadmin/mgmt/dashboard', request.url)))
    }
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
          userRole = norm;
        }

        // Fallback to database for Management paths
        const needsRoleLookup = !userRole || pathname.startsWith('/mgmt') || pathname.startsWith('/api/mgmt');
        if (needsRoleLookup) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role && typeof profile.role === 'string') {
            userRole = profile.role.trim().toLowerCase();
          }
        }

        // SECURITY: Strip superadmin privileges from Supabase relational database profiles
        if (userRole === 'superadmin' || userRole === 'super-admin' || userRole === 'super admin') {
          userRole = 'customer';
        }
      }
    } catch (e) {
      console.error('Middleware Supabase Error:', e);
    }
  }

  // ─── SUPERADMIN PATH PROTECTIONS ───────────────────────────────────────────
  if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
    const isLoginRoute = pathname === '/superadmin/login' || pathname === '/api/superadmin/login'
    if (!isLoginRoute && !isSuperadmin) {
      if (pathname.startsWith('/api/')) {
        return finalizeResponse(NextResponse.json({ error: 'Not Found' }, { status: 404 }))
      }
      return finalizeResponse(new NextResponse('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } }))
    }
  }

  // SECURITY: Fail-Closed API Protection
  if (pathname.startsWith('/api')) {
    if (!isPublicApiRoute && !user && !isSuperadmin) {
      return finalizeResponse(NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required for this endpoint' },
        { status: 401 }
      ))
    }

    // API Route Guards for each Role Tier (allow Superadmin to access admin API routes)
    if (pathname.startsWith('/api/admin') && userRole !== 'admin' && !isSuperadmin) {
      return finalizeResponse(NextResponse.json({ error: 'Not Found' }, { status: 404 }))
    }
    if (pathname.startsWith('/api/manager') && userRole !== 'manager' && !isSuperadmin) {
      return finalizeResponse(NextResponse.json({ error: 'Not Found' }, { status: 404 }))
    }
    if (pathname.startsWith('/api/sales-staff') && userRole !== 'sales-staff' && userRole !== 'sales' && !isSuperadmin) {
      return finalizeResponse(NextResponse.json({ error: 'Not Found' }, { status: 404 }))
    }
    if (pathname.startsWith('/api/sales-external') && userRole !== 'sales-external' && !isSuperadmin) {
      return finalizeResponse(NextResponse.json({ error: 'Not Found' }, { status: 404 }))
    }
  }

  // Protect Management Routes
  if (pathname.startsWith('/mgmt')) {
    if (!user) {
      const loginUrl = new URL('/staff/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return finalizeResponse(NextResponse.redirect(loginUrl))
    }
    
    // Check if the user has a valid staff role
    const STAFF_ROLES = new Set(['admin', 'manager', 'sales', 'sales-staff', 'sales-external', 'service_engineer', 'accounts'])
    if (!userRole || !STAFF_ROLES.has(userRole)) {
      return finalizeResponse(new NextResponse('Forbidden', { status: 403 }))
    }

    // Role path segregation & folder group checks
    if (pathname.startsWith('/mgmt/admin')) {
      if (userRole !== 'admin') {
        return finalizeResponse(new NextResponse('Not Found', { status: 404 }))
      }
      
      // Enforce strict folder guards: Admins can ONLY see staff, inventory, orders, purchase, invoice-lookup, quotes.
      const allowedAdminPaths = [
        '/mgmt/admin',
        '/mgmt/admin/staff',
        '/mgmt/admin/inventory',
        '/mgmt/admin/products', // products catalog is also part of inventory
        '/mgmt/admin/orders',
        '/mgmt/admin/purchase',
        '/mgmt/admin/invoice-lookup',
        '/mgmt/admin/quotes'
      ];
      const isAllowed = allowedAdminPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
      if (!isAllowed) {
        return finalizeResponse(new NextResponse('Forbidden', { status: 403 }))
      }
    }
    if (pathname.startsWith('/mgmt/manager') && userRole !== 'manager') {
      return finalizeResponse(new NextResponse('Not Found', { status: 404 }))
    }
    if (pathname.startsWith('/mgmt/sales-staff') && userRole !== 'sales-staff' && userRole !== 'sales') {
      return finalizeResponse(new NextResponse('Not Found', { status: 404 }))
    }
    if (pathname.startsWith('/mgmt/sales-external') && userRole !== 'sales-external') {
      return finalizeResponse(new NextResponse('Not Found', { status: 404 }))
    }
  }

  return finalizeResponse(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
