# Backend Analysis - 2026-03-23

## Findings

1. Public GET routes do not advertise response caching.
   - src/app/api/products/_route.ts GET returns catalog data without revalidate or Cache-Control headers.
   - src/app/api/page-content/_route.ts GET also returns uncached content.
   - src/app/api/settings/_route.ts GET similarly serves uncached responses.

2. High-cardinality queries still fetch broad payloads.
   - src/app/api/products/_route.ts uses select('*', { count: 'exact' }) for catalog responses.
   - settings and page-content routes also use select('*') patterns.
   - Broad selects increase payload size, serialization cost, and database work.

3. Product catalog queries do extra work during request handling.
   - The products route performs column discovery fallback logic and dynamic query adaptation.
   - This makes the route resilient, but it also adds overhead to the critical request path.

## Probable TTFB Drivers

- Uncached product, settings, and page-content reads.
- Full-row selects for read-heavy endpoints.
- Dynamic fallback logic on catalog lookups.
- Supabase round trips from a single Vercel region for all public reads.

## Highest-Value Backend Actions

1. Add route-level caching for anonymous public GET traffic.
2. Replace select('*') with explicit field lists on hot endpoints.
3. Separate resilient schema-fallback logic from the main happy path where possible.
4. Measure product API p50 and p95 latency directly after cache and select narrowing changes.