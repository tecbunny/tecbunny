# GOD OPS Performance Optimization — 2026-03-23

Website: https://www.tecbunny.com
Mode: Advisory
Score: 54/100
Status: Yellow

## Constraints

- A fresh Lighthouse baseline was not available in this environment.
- Existing `baseline-2026-03-23-mobile.json` and `baseline-2026-03-23-desktop.json` are placeholders because PageSpeed was rate limited.

## Evidence

- Home HTML response size is about `95KB`
- Products HTML response size is about `72KB`
- Largest current client chunks under `.next/static/chunks`:
  - `framework-70cab975c99f2d8c.js` — `178.5KB`
  - `fd9d1056-b8876c3c2a4c7670.js` — `168.8KB`
  - `1388-e6b21dc6c44557a0.js` — `154.3KB`
  - `2117-578e964da0abdf88.js` — `124.5KB`
  - `main-474da5bbcb939ee8.js` — `124KB`
  - `polyfills-42372ed130431b0a.js` — `110KB`

## Findings

### High — Client bundle weight is already large enough to pressure mobile interactivity

The top five chunks alone account for a substantial amount of client JavaScript before route-specific additions. That is a warning sign for INP and TBT even without a fresh Lighthouse run.

### Medium — Global image optimization is disabled

`next.config.mjs` sets `images.unoptimized` based on output mode. Remote images from Supabase are used heavily on the storefront. That reduces leverage from Next image optimization.

### Medium — Large public pages likely overfetch data

Code search shows frequent `select('*')` usage in product and page-content-related areas. That tends to increase payload sizes and serialization costs.

### Low — Fonts use `display: swap`

`src/app/layout.tsx` configures Google fonts with `display: 'swap'`, which is the correct default for perceived rendering stability.

## Recommended Actions

1. Produce a real Lighthouse baseline from CI or another environment that can run Chrome reliably.
2. Use a bundle analyzer build and identify the owners of the `168.8KB` and `154.3KB` chunks.
3. Re-enable optimized image handling for high-traffic storefront routes where feasible.
4. Replace public `select('*')` queries with explicit field lists.
5. Review third-party script necessity for Iubenda, Cloudflare analytics, and Google Analytics on first load.