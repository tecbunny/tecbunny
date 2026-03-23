# GOD OPS Deployment Validation — 2026-03-23

Website: https://www.tecbunny.com
Mode: Advisory
Score: 30/100
Status: Red

## Pre-Deploy Gate Status

1. `npm run typecheck` — Failed
2. `npm run build` — Not executed in this pass
3. Bundle size delta — Unknown
4. Production debug logging — Not fully reviewed
5. Hardcoded environment URLs — Not fully reviewed
6. New API auth checks — Mixed; middleware is fail-closed by default, but public exceptions are broad
7. Environment variable documentation — Not reviewed in this pass

## Current Blocking Evidence

- `src/components/products/ProductCard.tsx` fails typecheck because `onError` is passed to `OptimizedImage` in two places but the prop type does not allow it
- `next.config.mjs` disables TypeScript and ESLint enforcement during builds

## Assessment

Deployment is operationally risky right now. The repo can deploy despite type errors, and the live health endpoint expected for smoke verification is not present.

## Rollback and Verification Notes

- No rollback action was taken in this advisory pass
- A minimal production smoke suite should verify `/`, `/products`, `/checkout`, and `/api/health`

## Recommended Actions

1. Fix the `ProductCard` type errors.
2. Remove `ignoreBuildErrors` and `ignoreDuringBuilds` from `next.config.mjs`.
3. Add a release check that fails when `/api/health` is missing or non-200.
4. Capture build artifact size deltas per deployment.