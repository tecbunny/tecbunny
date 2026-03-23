# Animation & Motion Design Report
Target: homepage
Style: minimal
Mode: report
Library preference: auto
Performance mode: standard
Framework: Next.js App Router
Date: 2026-03-23

## Animation Map
| Component | Current Motion | Recommended Animation | Library | Impact |
|-----------|----------------|-----------------------|---------|--------|
| Primary hero | Canvas particle field, glitch headline, rotating word stack, magnetic CTAs, 3D tilt visual | Keep visual identity, but reduce to a single hero entrance sequence: headline fade-up, CTA stagger, visual panel soft float | CSS | High guidance, low JS cost |
| Header / nav | Sticky shrink already present | Add active-link slide indicator and smoother submenu enter/exit | CSS first, optional Framer Motion for indicator | High navigation clarity |
| Homepage hero carousel | Cross-fade slideshow with controls | Add subtle content slide-up per active slide, keep image fade only | CSS | Medium attention guidance |
| Core pillars cards | Cursor spotlight hover only | Add scroll reveal with stagger and mild hover lift | CSS or Framer Motion | High perceived polish |
| Service tiers section | Static cards | Add section fade-up and card stagger; emphasize highlighted plan on enter | CSS or Framer Motion | Medium hierarchy improvement |
| Featured hardware grid | Loading skeletons and hover border state | Add in-view stagger reveal and product image scale-on-hover | CSS or Framer Motion | High storefront engagement |
| Closing CTA | Static glow background | Add copy fade-up and CTA card rise-in | CSS | Medium conversion emphasis |
| Decorative background blobs | Static blurred gradients | Add very slow blob drift on desktop only | CSS | Low-cost atmosphere |

## Observed Homepage Structure
- Primary hero in [src/components/home-page.tsx](src/components/home-page.tsx#L307)
- Secondary homepage carousel in [src/components/home-page.tsx](src/components/home-page.tsx#L400)
- Core pillars grid in [src/components/home-page.tsx](src/components/home-page.tsx#L405)
- Service tiers section in [src/components/home-page.tsx](src/components/home-page.tsx#L471)
- Featured hardware grid in [src/components/home-page.tsx](src/components/home-page.tsx#L513)
- Closing CTA block in [src/components/home-page.tsx](src/components/home-page.tsx#L610)

## Current Motion Baseline
The homepage already includes multiple custom motion systems:

- Magnetic button transforms in [src/components/home-page.tsx](src/components/home-page.tsx) backed by [.magnetic-btn](src/app/globals.css#L486)
- Hero tilt card with mouse-driven perspective in [src/components/home-page.tsx](src/components/home-page.tsx) backed by [.tilt-card](src/app/globals.css#L516)
- Glitch headline in [.glitch-text](src/app/globals.css#L532)
- Rotating hero word stack in [.hero-rotator](src/app/globals.css#L564)
- Hover spotlight card treatment in [.spotlight-card](src/app/globals.css#L490), although the homepage cards currently implement the spotlight inline rather than reusing that utility
- Cross-fade hero carousel in [src/components/HeroCarousel.tsx](src/components/HeroCarousel.tsx#L154)
- Header shrink-on-scroll and menu transitions in [src/components/layout/Header.tsx](src/components/layout/Header.tsx#L188)

This means the page is not motion-free today. The issue is not absence of animation; it is lack of orchestration and inconsistent accessibility handling.

## Key Findings
1. The hero is already visually dense, so adding more effects there would be counterproductive.
   The better move is consolidation: reduce simultaneous motion and replace it with a timed entrance sequence.

2. Section-to-section flow is mostly static after the hero.
   The pillars, plan tiers, hardware grid, and final CTA do not currently reveal progressively, so the page loses momentum after the first viewport.

3. Reduced-motion support is incomplete.
   A global reduced-motion rule exists in [src/app/globals.css](src/app/globals.css#L451), but JS-driven motion systems do not currently check user preference:
   - the hero canvas particle loop in [src/components/home-page.tsx](src/components/home-page.tsx)
   - the rotating hero word interval in [src/components/home-page.tsx](src/components/home-page.tsx)
   - the auto-advancing homepage carousel in [src/components/HeroCarousel.tsx](src/components/HeroCarousel.tsx)

4. The current carousel only fades entire slides.
   That is safe for CLS, but it misses an opportunity to animate slide content hierarchy, especially CTA text.

5. Header motion is present but under-leveraged.
   The navbar already changes density on scroll in [src/components/layout/Header.tsx](src/components/layout/Header.tsx#L188), but active-state indication still relies on a static dot instead of a clearer motion cue.

## Recommended Motion Plan
### 1. Primary hero
- Replace the loader fade, glitch, particle field, tilt, and word rotation acting at once with a tighter sequence:
  - badge fades in first
  - headline rises in
  - supporting copy fades in
  - CTA row staggers in
  - right-side status panel drifts in with 8px translateY
- Keep either the particle canvas or the glitch effect, not both.
- Keep magnetic CTA behavior only on desktop pointer devices.

Recommended library: CSS
Reason: existing custom behavior is already bespoke, and adding Framer Motion on top would increase complexity without replacing enough code.

### 2. Homepage carousel
- Preserve transform-free image cross-fade for safety.
- Add content-only reveal per active slide:
  - subtitle opacity + 12px translateY
  - title opacity + 16px translateY
  - CTA opacity + 12px translateY with 60ms stagger
- Do not inject wrappers inside sanitized HTML content in [src/components/HeroCarousel.tsx](src/components/HeroCarousel.tsx#L175).
  Animate the article overlay container instead.

Recommended library: CSS

### 3. Core pillars
- Add scroll reveal stagger across the four cards.
- Keep the spotlight hover, but add a subtle hover lift using transform only.
- Use `viewport once` behavior if implemented with JS; otherwise a CSS class toggled by IntersectionObserver is enough.

Recommended library: CSS by default, Framer Motion only if the team wants reusable in-view primitives.

### 4. Service tiers
- Fade the section copy up.
- Stagger the three plan cards.
- Give the highlighted plan a slightly delayed shadow/opacity accent so the eye lands there naturally.

Recommended library: CSS

### 5. Featured hardware
- Reveal cards with stagger on scroll.
- Add image scale-on-hover and CTA button micro-interaction.
- Keep skeletons, since they improve perceived performance.

Recommended library: CSS

### 6. Closing CTA
- Add a two-part reveal:
  - left copy block fade-up
  - right consultation card rise-in with 80ms delay
- Add slow decorative blob drift only on desktop and only outside reduced-motion mode.

Recommended library: CSS

### 7. Header / navigation
- Keep the existing scroll shrink.
- Replace the static active dot with an underline slide or shared pill background motion.
- Keep dropdown entrance to opacity + translateY only.

Recommended library: CSS first, optional Framer Motion if a `layoutId` indicator is preferred.

## Library Selection
- Current repo status: `framer-motion`, `gsap`, and `lottie` are not installed in [package.json](package.json)
- Recommended default for homepage: CSS-only
- Optional upgrade path: add `framer-motion` only if you want a reusable reveal system across multiple marketing pages

Install command if chosen later:

```bash
npm install framer-motion
```

## Performance Impact
- Recommended default implementation: CSS-only, 0KB extra JS
- Optional Framer Motion path: approximately 12 to 18KB gzipped, tree-shaken
- Estimated CLS risk: Low if all animations remain on `transform` and `opacity`
- Largest Contentful Paint risk: Medium if hero animations delay text visibility; keep all hero content visible within 0 to 150ms and avoid long intro delays

## Accessibility
- Existing baseline: global reduced-motion override exists in [src/app/globals.css](src/app/globals.css#L451)
- Missing baseline: JS-driven motion checks for reduced motion are not present on the homepage

Required before any implementation:
- Add a reduced-motion gate for the hero particle canvas
- Disable hero word rotation when reduced motion is requested
- Pause carousel auto-advance when reduced motion is requested
- Mark any new decorative blobs as `aria-hidden="true"`
- Keep focus rings unobstructed by overlays and gradient layers

## CLS / Motion Safety Rules For This Page
- Safe: `opacity`, `transform`, limited `filter`, limited `box-shadow`
- Avoid: animating width, height, top, left, margin, padding, or font-size
- Avoid long-running infinite motion on text elements
- Avoid more than one continuously animated hero system at the same time

## Proposed Sequence By Priority
1. Add reduced-motion guards to existing JS motion systems
2. Add scroll reveal system for pillars, plans, hardware, and CTA
3. Improve carousel content transitions
4. Upgrade header active-state motion
5. Simplify or consolidate hero effects if the page still feels over-animated

## Manual Steps Required
- None for the CSS-only path
- Optional: install `framer-motion` if you want reusable in-view and shared-layout animation primitives

## Summary
The homepage does not need more animation volume. It needs better animation hierarchy. The most effective upgrade is a CSS-first reveal system across the lower sections, paired with reduced-motion compliance for the hero canvas, word rotation, and carousel. That yields the biggest UX gain with essentially no bundle increase.