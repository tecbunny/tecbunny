# Regression Report - 2026-03-23

## Status

- No prior valid baseline artifact was available for comparison in this cycle.
- New baseline collection was attempted but blocked by environment issues:
  - local Lighthouse dependency resolution failure
  - PageSpeed Insights API 429 rate limiting

## Result

- Quantitative regression detection: unavailable for this cycle
- Qualitative risk detection: available

## Qualitative Risk Flags

- Shared client chunks above 100 KB remain present.
- Public APIs appear uncached.
- Global third-party scripts remain mounted in the root layout.
- Public-facing image rendering still relies on raw img in multiple components.

## Recommendation

- Restore a valid synthetic baseline first, then compare future Lighthouse score, LCP, TTFB, and bundle-size deltas against it.