# GOD OPS Dashboard — 2026-03-23

## System Health Summary
| Domain | Score | Status | Issues | Actions Taken |
|--------|-------|--------|--------|---------------|
| Infrastructure | 76/100 | Green | 1 | Advisory only |
| Security | 56/100 | Yellow | 3 | Advisory only |
| Performance | 52/100 | Yellow | 2 | Advisory only |
| Deployment | 32/100 | Red | 2 | Advisory only |
| Observability | 55/100 | Yellow | 1 | Advisory only |
| Cost Efficiency | 46/100 | Yellow | 1 | Advisory only |
| Business Growth | 78/100 | Green | 1 | Advisory only |
| UX Health | 74/100 | Yellow | 1 | Advisory only |

## Active Incidents

1. Build validation is bypassed while the repo currently fails typecheck.
2. Public auth endpoints do not enforce explicit route-level rate limits.
3. CSP is permissive and split between middleware and Next config.
4. Product/image delivery and broad data fetches are increasing performance and cost risk.

## Fixes Applied This Cycle

- None. Advisory mode only.

## Manual Actions Required

1. Remove `ignoreBuildErrors` and `ignoreDuringBuilds` after fixing the current syntax/type failures.
2. Add throttling to signup and OTP routes.
3. Consolidate CSP into one source of truth and reduce inline/eval allowances.
4. Re-run Lighthouse with a working Chrome runtime.
5. Trim public Supabase queries to explicit field lists.

## Predictive Alerts (Next 30 Days)

- If build gating remains disabled, a syntax or type regression is likely to ship undetected.
- If `select('*')` remains common on public routes, payload growth will continue to erode latency and cost efficiency.
- If image optimization remains disabled, catalog growth will further increase LCP risk on mobile.
- If auth endpoints remain CAPTCHA-only, abuse pressure will eventually show up as OTP cost spikes or support noise.

## Knowledge Base Updates

- tecbunny.com is a Next.js 14 app deployed on Vercel with region bom1.
- Live storefront content and lead-capture pages are publicly reachable.
- Current advisory blockers are primarily deployment safety and auth abuse resistance, not outright availability.