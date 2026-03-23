# GOD OPS Cost Efficiency — 2026-03-23

Website: https://www.tecbunny.com
Mode: Advisory
Score: 49/100
Status: Yellow

## Findings

### Medium — Broad `select('*')` usage will inflate transfer and compute cost over time

Search results show widespread full-row Supabase selects across public, admin, and analytics code paths. On a growing catalog and CRM system, this becomes an avoidable cost driver.

### Medium — Global image optimization is not fully leveraged

When remote product images dominate public pages, unoptimized delivery shifts cost and latency to heavier page payloads and client work.

### Medium — Large client chunks increase bandwidth and cache churn

The current build output includes several chunks well over `100KB`, which raises CDN and end-user transfer cost.

## Positive Signals

- Vercel region is explicitly pinned to `bom1`, which is appropriate for a Goa-based business focus
- `robots.txt` blocks account and checkout areas from indexing, which helps avoid wasted crawl traffic on private surfaces

## Recommended Actions

1. Prioritize replacing `select('*')` on public routes first.
2. Review large client chunks with a bundle analyzer.
3. Reassess image optimization strategy for storefront-heavy pages.