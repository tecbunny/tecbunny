# GOD OPS Dashboard — 2026-03-23 Advisory Refresh

## System Health Summary
| Domain | Score | Status | Issues | Actions Taken |
|--------|-------|--------|--------|---------------|
| Infrastructure | 74/100 | Yellow | 1 | Advisory only |
| Security | 58/100 | Yellow | 4 | Advisory only |
| Performance | 54/100 | Yellow | 3 | Advisory only |
| Deployment | 30/100 | Red | 2 | Advisory only |
| Observability | 57/100 | Yellow | 3 | Advisory only |
| Cost Efficiency | 49/100 | Yellow | 3 | Advisory only |
| Business Growth | 79/100 | Green | 2 | Advisory only |
| UX Health | 76/100 | Yellow | 2 | Advisory only |

## Active Incidents

1. `npm run typecheck` fails in `src/components/products/ProductCard.tsx`.
2. Production `/api/health` returns `404`.
3. Live CSP still allows `unsafe-eval` and is defined in two places.
4. Client bundles are already heavy enough to create ongoing performance pressure.

## Fixes Applied This Cycle

- None. Advisory mode only.

## Manual Actions Required

1. Fix the `OptimizedImage` prop mismatch in `src/components/products/ProductCard.tsx`.
2. Restore strict build gating in `next.config.mjs`.
3. Expose and verify `/api/health` in production.
4. Consolidate CSP and remove `unsafe-eval` if possible.
5. Add route-level throttling to signup and OTP endpoints.
6. Replace public `select('*')` queries with explicit columns.
7. Produce a real Lighthouse baseline from an environment that can run it.

## Predictive Alerts (Next 30 Days)

- If build gating stays disabled, a production regression is likely to ship undetected.
- If chunk sizes continue to grow at the current level, mobile performance will degrade before the next major catalog expansion.
- If auth endpoints remain CAPTCHA-only, OTP abuse cost and support noise are likely to increase.
- If `/api/health` remains absent, post-deploy regressions will be detected later than they should be.

## Knowledge Base Updates

- `www.tecbunny.com` is live on Vercel in `bom1` and serves the public storefront successfully.
- Current top risks are release safety, live health visibility, CSP hardening, and bundle weight.