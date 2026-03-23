# Frontend Analysis - 2026-03-23

## Findings

1. Image optimization is partially disabled at the framework level.
   - next.config.mjs sets images.unoptimized to true.
   - This prevents automatic Next.js image optimization benefits for public pages.

2. Public-facing components still use raw img tags.
   - src/components/home-page.tsx uses raw img for featured product tiles.
   - src/components/products/ProductCard.tsx uses raw img in both list and grid views.
   - src/app/ai-research/page.tsx also renders raw img.
   - Several of these images rely on CSS sizing instead of consistent intrinsic dimensions, which keeps CLS and payload inefficiency risk elevated.

3. Third-party scripts are loaded globally from the root layout.
   - src/app/layout.tsx mounts Iubenda autoblocking and GPP scripts with beforeInteractive.
   - The same layout also mounts Cloudflare analytics, Vercel analytics, Google Analytics, and a floating AI assistant globally.
   - This increases the chance of blocking work and larger shared bundles across all routes.

4. Shared layout JavaScript is heavy.
   - The local app-build-manifest shows /layout loading many shared chunks.
   - Multiple chunks above 100 KB are reused across many routes.

## Probable CWV Impact

- LCP risk: global script work, unoptimized images, and heavy shared layout chunks.
- CLS risk: raw images rendered without consistently declared intrinsic size.
- INP/TBT risk: root-level third-party script cost and client-side providers mounted on every page.

## Highest-Value Frontend Actions

1. Re-enable Next.js image optimization for public pages or selectively scope unoptimized only where strictly required.
2. Convert public storefront and landing-page raw img usage to next/image, or at minimum add stable width and height everywhere.
3. Reassess whether Iubenda autoblocking truly requires beforeInteractive; if not, move it later.
4. Defer or conditionally mount non-critical root layout features such as the floating AI assistant on pages that do not use it.