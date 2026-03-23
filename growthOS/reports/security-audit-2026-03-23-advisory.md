# GOD OPS Security Audit — 2026-03-23

Website: https://www.tecbunny.com
Mode: Advisory
Score: 58/100
Status: Yellow

## Findings

### High — CSP allows `unsafe-eval` and `unsafe-inline` for scripts

Evidence:
- Live header includes `script-src 'self' 'unsafe-inline' 'unsafe-eval' ...`
- `next.config.mjs` defines this CSP globally

Impact:
- XSS blast radius is larger than necessary
- `unsafe-eval` is especially difficult to justify on a public commerce site

### High — Two competing CSP definitions exist

Evidence:
- `next.config.mjs` sets a CSP through `headers()`
- `middleware.ts` also sets a different CSP at runtime

Impact:
- Harder to reason about effective policy
- Easier to accidentally regress security headers during future changes

### Medium — Public auth routes do not consistently show route-level throttling

Evidence:
- `src/app/api/auth/signup/_route.ts` has CAPTCHA but no explicit `rateLimit` call
- `src/app/api/auth/send-otp/_route.ts` has CAPTCHA but no explicit `rateLimit` call
- Other routes in the repo do use `src/lib/rate-limit.ts`

Impact:
- OTP abuse and signup spam remain plausible even with CAPTCHA in place

### Medium — Public route allowlist in middleware is broad

Evidence:
- `middleware.ts` allows `/api/settings`, `/api/page-content`, `/api/auto-offers`, `/api/coupons`, and `/api/products` without authentication
- `src/app/api/settings/_route.ts` has its own key allowlist, which is better than fully open access, but the middleware-level exception remains broad by prefix

Impact:
- A future handler change can become public by accident if it stays under one of these prefixes

### Low — `dangerouslySetInnerHTML` use appears controlled in reviewed paths

Evidence:
- `src/app/layout.tsx` injects JSON-LD using `JSON.stringify`
- `src/components/HeroCarousel.tsx` sanitizes HTML with DOMPurify before injection

Impact:
- No immediate finding from reviewed cases, but this should stay under review

## Header Posture

- Present live: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`
- Not observed live in sampled responses: `Referrer-Policy`, `Permissions-Policy`
- Server header leak: `Server: Vercel`

## Secret and Dependency Risk Notes

- Code review did not reveal hardcoded live credentials in the reviewed files
- The dependency graph is large and includes multiple commerce, analytics, and upload surfaces; a formal `npm audit` run was not performed in this pass

## Recommended Actions

1. Remove `unsafe-eval` from CSP unless a verified dependency requires it.
2. Consolidate CSP and shared security headers into one implementation path.
3. Add explicit IP and identifier throttling to signup and OTP routes.
4. Narrow middleware public-route prefix rules where possible.
5. Add a recurring dependency audit in CI.