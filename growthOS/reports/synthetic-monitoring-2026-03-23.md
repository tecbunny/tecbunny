# Synthetic Monitoring - 2026-03-23

- Mode: Advisory
- URL: https://www.tecbunny.com
- Stack: Next.js 14 on Vercel
- Region hint: bom1 from vercel.json

## Thresholds

- LCP good: <= 2.5s
- INP good: <= 200ms
- CLS good: <= 0.1
- TTFB good: <= 800ms

## Live Probe

- Status code: 200
- Approximate response time from this environment: 1.053s
- Final URL: https://www.tecbunny.com/
- Server: Vercel
- Cache-Control: public, must-revalidate, max-age=0
- Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch
- ETag present: yes

## Synthetic Audit Artifact Status

- Local Lighthouse: blocked by npm dependency resolution failure while installing Lighthouse in this environment.
- PageSpeed Insights API: returned 429 for both desktop and mobile attempts.
- Baseline placeholders written to:
  - growthOS/reports/baseline-2026-03-23-desktop.json
  - growthOS/reports/baseline-2026-03-23-mobile.json

## Initial Interpretation

- TTFB is in Needs improvement based on the direct probe and exceeds the APOS good threshold of 800ms.
- Missing Lighthouse-derived LCP, INP, CLS, and TBT means this cycle is evidence-based but not fully instrumented.
- The next cycle should prioritize restoring reliable synthetic collection so regressions can be quantified.