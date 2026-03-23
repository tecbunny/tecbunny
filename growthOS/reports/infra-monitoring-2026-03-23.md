# Infrastructure Monitoring - 2026-03-23

## Deployment Context

- Deployment target: Vercel
- Framework: Next.js
- Primary region configured: bom1
- Build output directory: .next

## Current Build Artifact Signals

Largest client chunks from the local .next build:

- framework-70cab975c99f2d8c.js: 178.5 KB
- fd9d1056-b8876c3c2a4c7670.js: 168.8 KB
- 1388-e6b21dc6c44557a0.js: 154.3 KB
- 2117-578e964da0abdf88.js: 124.5 KB
- main-474da5bbcb939ee8.js: 124.0 KB
- polyfills-42372ed130431b0a.js: 110.0 KB

## Shared Bundle Risk

- The root app layout pulls a large shared client set into many routes.
- app-build-manifest shows /layout includes the 154.3 KB 1388 chunk in addition to multiple other shared chunks.
- This is consistent with global client-side weight rather than a single isolated page problem.

## Operational Implication

- Any optimization in the root layout or globally mounted client components will have broad impact across public pages.
- Region pinning to bom1 may improve India latency but can increase TTFB for far geographies if cache hit ratio is low.