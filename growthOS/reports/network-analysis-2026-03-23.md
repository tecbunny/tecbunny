# Network Analysis - 2026-03-23

## Observed Response Behavior

- Host responds from Vercel.
- HTML response advertised Cache-Control: public, must-revalidate, max-age=0.
- ETag is present.
- Vary includes RSC, Next-Router-State-Tree, and Next-Router-Prefetch.

## Interpretation

1. HTML is effectively dynamic from a browser caching perspective.
   - max-age=0 means repeat visits will revalidate immediately.

2. TTFB is above the APOS good threshold.
   - Direct probe measured about 1.053s.
   - This is a concrete signal even without Lighthouse.

3. CDN effectiveness for distant geographies may be limited by origin dynamics.
   - The project is pinned to bom1 in vercel.json.
   - If public data endpoints are uncached, users far from the region will feel the penalty more strongly.

4. Third-party origin count is non-trivial.
   - CSP and layout usage confirm dependencies on Iubenda, Cloudflare Insights, Google Tag Manager, Google Fonts, and Cloudflare Turnstile.
   - Extra origins increase connection setup and script coordination cost.

## Highest-Value Network Actions

1. Push anonymous public data behind stronger CDN-cacheable GET semantics.
2. Reduce early third-party script pressure in the root layout.
3. Capture a fresh synthetic run with working Lighthouse or PSI to validate LCP and request waterfalls across mobile and desktop.