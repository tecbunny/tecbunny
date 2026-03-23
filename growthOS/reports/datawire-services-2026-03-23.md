# DataWire Guardian Report
Page: /services
Date: 2026-03-23
Mode: codebase
Fix Level: 1
Environment: local workspace

## Assumptions
- Defaulted to codebase mode because no runtime mode was specified.
- Defaulted to fix level 1 (report only) because no patching or auto-fix request was given.
- Treated the current workspace as the effective development environment.

## Integration Health Score
API Connectivity:        72%
Form Wiring:             100%
Auth Flow:               68%
State Management:        84%
Third-Party SDKs:        78%
Analytics Tracking:      42%
Overall Score:           74%

## ❌ Issues Found
| # | Severity | Category | Description | File | Line |
|---|----------|----------|-------------|------|------|
| 1 | HIGH | Auth / Data Access | The public `/services` page can query `services` through `createServiceClient()` and `select('*')`, then spreads each row into the serialized client payload. This bypasses RLS for the fetch path and can leak admin-only columns if they exist on the table. | src/app/services/page.tsx | 25 |
| 2 | HIGH | Analytics Tracking | `/services` CTA events send `cta`, `destination`, `serviceId`, and `serviceTitle` as top-level fields, but the analytics API only extracts `eventType`, `pageUrl`, `resourceId`, `metadata`, and `sessionId`. The service-specific click context is dropped before persistence and before GA Measurement Protocol forwarding. | src/hooks/use-analytics.ts | 48 |
| 3 | MEDIUM | Error Handling / UX | Service fetch failures are converted to `services = []` after logging, and the client page renders section lists only from that array. Users see a normal page with missing catalog content instead of an empty-state or service-unavailable message, so broken data flow is masked as valid content. | src/app/services/page.tsx | 33 |

## ✅ Fixes Applied
| # | Issue | Fix Applied | File | Line |
|---|-------|-------------|------|------|
| 1 | Report-only run | No code changes applied | N/A | N/A |

## ⚠️ Manual Actions Required
| # | Action | Reason |
|---|--------|--------|
| 1 | Review the `services` table schema and identify any columns that should never reach the public client. | The route currently fetches all columns and serializes the normalized row object. |
| 2 | Decide on the analytics contract shape for custom event attributes. | The client and API disagree on whether extra event data should be top-level fields, `resourceId`, or nested `metadata`. |
| 3 | Confirm whether an empty `/services` catalog should be treated as a user-visible outage state. | The current page silently hides upstream fetch failures. |

## 📊 Data Flow Graph
```text
Visitor
  -> src/app/services/page.tsx
     -> createServiceClient() or createClient()
        -> Supabase services table
           -> normalize / filter / sort services
              -> src/components/services-page.tsx
                 -> CTA buttons
                    -> router.push('/contact?...')
                    -> router.push('/cctv-installation-goa')
                    -> router.push('/annual-maintenance-contract-goa')
                    -> router.push('/home-automation-goa')
                    -> router.push('/rfid-lock-system-goa')
                 -> pricing CTA
                    -> useCart().addToCart()
                       -> CartProvider cart state
                          -> router.push('/checkout?source=services')
                 -> useAnalytics().trackEvent()
                    -> POST /api/analytics/track
                       -> analytics_events insert
                       -> Google Analytics Measurement Protocol
```

## Route Scan Notes
- Route entrypoint: `src/app/services/page.tsx`
- Main client component: `src/components/services-page.tsx`
- Primary data source: Supabase `services` table
- Interactive elements found:
  - Static CTA cards routing to local landing pages
  - Service card CTA buttons routing to `/contact` with prefilled query params
  - Pricing tier buttons adding synthetic service products to cart and redirecting to checkout
  - Admin-only manage link gated by `usePermissions().atLeast('admin')`
- Forms detected on this route: none

## Root Cause Analysis
1. Service-role exposure risk
   The route prefers `createServiceClient()` when the service key is configured. Because it also requests `select('*')` and preserves `...s` during normalization, the public route has no projection boundary. The page does filter inactive rows, but it does not prevent accidental exposure of other columns.

2. Analytics contract mismatch
   The client-side analytics helper posts arbitrary properties at the top level of the JSON body. The API route ignores those fields unless they are mapped into `resourceId` or `metadata`. `/services` relies heavily on custom CTA attributes, so the route's analytics are materially incomplete.

3. Silent degraded state
   Both Supabase query failures and outer page failures fall back to an empty array. The client component reduces and maps over that array without a missing-data branch, so operators get logs but users get no indication that live service content failed to load.

## Verification Results
- TypeScript: FAIL
  - `middleware.ts:226` has a syntax error (`TS1128`).
  - `src/app/sitemap.ts:97-140` has multiple syntax errors (`TS1136`, `TS1137`, `TS1005`, `TS1109`, `TS1128`).
- Build: NOT RUN
  - Skipped after baseline typecheck failures unrelated to `/services` blocked meaningful verification.
- Integration tests: 0/0 passing
  - No route-specific automated integration tests were found or run in this codebase-mode pass.

## Referenced Code Paths
- `src/app/services/page.tsx:25`
- `src/app/services/page.tsx:30`
- `src/app/services/page.tsx:33`
- `src/app/services/page.tsx:42`
- `src/app/services/page.tsx:86`
- `src/components/services-page.tsx:220`
- `src/components/services-page.tsx:389`
- `src/components/services-page.tsx:411`
- `src/components/services-page.tsx:433`
- `src/components/services-page.tsx:455`
- `src/components/services-page.tsx:466`
- `src/components/services-page.tsx:508`
- `src/hooks/use-analytics.ts:41`
- `src/hooks/use-analytics.ts:48`
- `src/app/api/analytics/track/_route.ts:93`
- `src/app/api/analytics/track/_route.ts:108`
- `src/app/api/analytics/track/_route.ts:110`
- `src/app/api/analytics/track/_route.ts:111`