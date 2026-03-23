# Performance Health - 2026-03-23

Overall Score: Incomplete instrumentation
Status: Needs Attention

## Core Web Vitals Snapshot

- LCP: unavailable this cycle
- INP: unavailable this cycle
- CLS: unavailable this cycle
- TTFB: ~1053ms [Needs improvement]

## Ranked Action Plan

1. Owner: Frontend
   Effort: Medium
   Expected impact: High
   Action: Remove or narrowly scope images.unoptimized and migrate public storefront img usage to next/image or fixed intrinsic dimensions.

2. Owner: Frontend / Legal
   Effort: Medium
   Expected impact: High
   Action: Re-evaluate root-level Iubenda autoblocking and GPP scripts that currently run beforeInteractive.

3. Owner: Backend
   Effort: Medium
   Expected impact: High
   Action: Add caching semantics to public GET routes for products, page content, and settings.

4. Owner: Backend
   Effort: Low
   Expected impact: Medium
   Action: Replace select('*') with explicit column lists on hot read paths.

5. Owner: Frontend Platform
   Effort: Medium
   Expected impact: Medium
   Action: Reduce shared root layout client weight by conditionally mounting non-critical client features.

6. Owner: Performance Ops
   Effort: Low
   Expected impact: High
   Action: Restore reliable synthetic collection so Lighthouse, LCP, CLS, and INP can be tracked on each cycle.

## Issues Found This Cycle

- 1 High: shared root layout weight is large and broadly reused
- 1 High: public GET APIs lack cache semantics
- 1 High: public pages still use raw img in key components
- 1 Medium: third-party script load order is aggressive in root layout
- 1 Medium: current cycle lacks valid Lighthouse baseline artifacts

## Fixes Applied

- None in advisory mode

## Manual Actions Required

- Re-run synthetic auditing from an environment with working Lighthouse or a PageSpeed quota that is not rate limited.