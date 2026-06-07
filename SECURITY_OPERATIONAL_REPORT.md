# TecBunny Security, QA, and Operations Report

Review date: 2026-06-07  
Scope: Next.js app routes, Supabase access patterns, OTP and email gateways, CRM/order/inventory/product domains, frontend risk points, package audit, and verification commands.

## Part 1: Security Flaws

### Issue 1.1: Public API allowlist allowed mutating methods on sensitive resources
- File and lines: `middleware.ts:21-37`
- Exact flaw: The previous public API prefix allowlist treated `/api/page-content`, `/api/settings`, `/api/offers`, `/api/coupons`, `/api/products`, and `/api/auto-offers` as fully public for every HTTP method. Several of those route files use service-role Supabase clients for writes.
- Potential impact: Unauthenticated write/delete/list behavior could bypass RBAC and mutate content, coupons, settings, catalog data, and homepage content. This is OWASP Broken Access Control and can become stored XSS if content HTML is later rendered.
- Remediation performed:
  1. Converted public API entries to `{ path, methods }`.
  2. Restricted content/catalog/offer/settings public access to `GET` only.
  3. Left only auth, health, analytics, and captcha endpoints method-public.
  4. Verified `npm run typecheck` passes.
- Remaining action: Add regression tests that assert unauthenticated `POST/PUT/DELETE` on these prefixes return `401` or route-specific `403`.

### Issue 1.2: `/api/page-content` used service role without route-level admin authorization
- File and lines: `src/app/api/page-content/route.ts:17-19`, `253-287`, `295-366`, `373-441`
- Exact flaw: The route constructs a Supabase client with `SUPABASE_SERVICE_ROLE_KEY` but previously did not require admin context for `PUT`, `POST`, or `DELETE`.
- Potential impact: Public writes could deface page content and store malicious payloads, with direct RLS bypass because of the service role.
- Remediation performed:
  1. Added `requireAdminContext()` to `PUT`, `POST`, and `DELETE`.
  2. Added explicit `AdminAuthError` handling with correct status propagation.
  3. Middleware now only allows unauthenticated `GET` for `/api/page-content`.
- Remaining action: Prefer separate read and write clients so `GET` never initializes a service-role client. Current `GET` can still use the service key when present, although it is read-only in route behavior.

### Issue 1.3: Legacy OTP endpoints exposed sensitive flows without authentication
- File and lines: `src/app/api/otp/generate/route.ts:22-29`, `67-99`, `101-120`, `152-163`, `179-181`; `src/app/api/otp/verify/route.ts:14-18`, `192-196`; `src/app/api/otp/resend/route.ts:10-15`, `127-131`
- Exact flaw: Legacy `/api/otp/generate`, `/api/otp/verify`, and `/api/otp/resend` were callable without an authenticated session. The generate response also included raw provider response metadata.
- Potential impact: OTP spam, OTP status probing, provider data leakage, and brute-force staging against a known phone target such as `+917387375651`.
- Remediation performed:
  1. Added `requireApiRole()` to generate, verify, resend, and status handlers.
  2. For `agent_order`, require an approved sales agent record bound to `access.session.user.id`.
  3. Reject request payload `agentId` mismatches.
  4. Removed `providerResponse` from the public generate response.
- Remaining action: Move OTP brute-force enforcement into a database RPC keyed by OTP id plus phone/email, not only route logic. Also avoid using `OTP_RATE_LIMIT_BYPASS=true` outside local development.

### Issue 1.4: Superadmin login lacked route-level throttling
- File and lines: `src/app/api/superadmin/login/route.ts:4`, `20-27`, `49`
- Exact flaw: Superadmin password verification had captcha support but no IP/user identifier throttle in the login route.
- Potential impact: Credential stuffing or brute-force attempts against the superadmin login, especially when captcha is absent or misconfigured.
- Remediation performed:
  1. Added `rateLimit` by client IP.
  2. Added `rateLimit` by submitted user identifier.
  3. Log rate-limited events without exposing password material.
- Remaining action: The rate limiter is in-memory. Use Redis, Upstash, or Supabase-backed counters for multi-instance deployments.

### Issue 1.5: Quick login enabled by default in non-production and used a fixed fallback password
- File and lines: `src/app/api/auth/quick-login/route.ts:7-9`, `19-26`, `37-43`
- Exact flaw: Quick login automatically enabled in non-production and defaulted to `Password123!`. Redirect handling also accepted external origins.
- Potential impact: Shared development/staging deployments could be entered with a known credential. External redirects could support phishing after successful auth.
- Remediation performed:
  1. Quick login now requires `QUICK_LOGIN_ENABLED=true`.
  2. Removed the fallback password.
  3. Enforced `QUICK_LOGIN_PASSWORD` length >= 12.
  4. Restricted redirect target to same origin.
- Remaining action: Remove this endpoint from production builds or guard it with an additional internal token.

### Issue 1.6: Dependency vulnerabilities remain partially unresolved
- File and lines: `package.json:63`, `68`, `70`, `89`, `103-104`; `package-lock.json`
- Exact flaw: `npm audit --omit=dev --json` still reports 3 production advisories: high Next.js advisories and moderate `postcss` under Next, plus moderate `ws`. The registry available during this review did not publish the audit-suggested `next@15.5.18` / `next@16.2.6` or `ws@8.20.1`. Attempted Next 16.2.4 upgrade caused framework type resolution failures, so the app was returned to working Next 15.5.15.
- Potential impact: Framework middleware bypass, SSRF, DoS, XSS/cache poisoning, and WebSocket memory disclosure advisories remain as deployment blockers until a published compatible Next/ws patch is available.
- Remediation performed:
  1. Updated `dompurify` to `3.4.1`.
  2. Updated root `postcss` to `8.5.14`.
  3. `npm audit fix --omit=dev` updated XML and Nodemailer transitive packages in `package-lock.json`.
  4. Updated Next to latest available 15.x, `^15.5.15`, while preserving typecheck.
- Remaining action:
  1. Re-run `npm view next version` and `npm audit` when `15.5.18` or a compatible later stable version is published.
  2. Upgrade Next in a dedicated compatibility branch with build/browser regression tests.
  3. Re-run audit until production vulnerabilities are zero.

### Issue 1.7: Additional service-role placeholder patterns remain
- File and lines: examples found at `src/lib/whatsapp-service.ts:9`, `src/lib/supabase/env.ts:44`, `src/app/api/users/route.ts:10`, `src/app/api/settings/route.ts:9`, `src/app/api/coupons/route.ts:8`, `src/app/api/auth/signup/route.ts:10`
- Exact flaw: Several files still use placeholder service-role fallback strings. Some routes also create admin clients with service role and must be audited individually.
- Potential impact: In local/staging environments this can mask missing secrets. In production, any route-level auth omission around these clients becomes an RLS bypass.
- Remediation plan:
  1. Replace placeholder service-role fallback values with strict env validation.
  2. Centralize admin client creation through `createServiceClient()`.
  3. Require route-level guards before every service-role mutation.
  4. Add tests scanning for `placeholder-service` and unauthenticated service-role routes.

## Part 2: Design & Layout Flaws

### Issue 2.1: `dangerouslySetInnerHTML` is used in several frontend components
- File and lines: `src/components/products/ProductDetailPage.tsx:497`, `615`; `src/components/offers-page.tsx:247`, `329`; `src/components/HeroCarousel.tsx:172`; `src/components/policy-page.tsx:169`, `194`; `src/app/layout.tsx:294`
- Exact flaw: HTML injection points exist. Some paths sanitize, but not every JSON-LD or rich content path uses the same sanitizer.
- Potential impact: Stored XSS if CMS/product/offer content is compromised. DOMPurify was previously vulnerable before the package update.
- Remediation plan:
  1. Require `sanitizeHtml` or `DOMPurify.sanitize` for every rich-text render.
  2. Keep JSON-LD serializers escaping `<` consistently.
  3. Add a lint rule or wrapper component to ban raw `dangerouslySetInnerHTML`.

### Issue 2.2: Custom regex sanitizer is not equivalent to a full HTML parser
- File and lines: `src/lib/sanitize-html.ts:36-88`
- Exact flaw: Sanitization is based on regex replacements and allowlists, not a DOM parser. It also allows `class` and raw attribute value forwarding.
- Potential impact: Obfuscated HTML or malformed attributes may bypass intended filtering.
- Remediation plan:
  1. Replace regex sanitizer with DOMPurify server/client usage.
  2. Remove `class` unless needed for trusted CMS templates.
  3. Add XSS fixture tests for mixed case tags, malformed attributes, encoded protocols, SVG, MathML, and nested tags.

### Issue 2.3: Styled JSX usage is incompatible with direct TypeScript checking in several client files
- File and lines: examples from typecheck with Next 16: `src/app/auth/signup/page.tsx:250`, `281`; `src/app/auth/signin/page.tsx:271`; `src/components/products/ProductDetailPage.tsx:369`; `src/components/profile/UserProfile.tsx:173`
- Exact flaw: `<style jsx global>` is used in TSX. It currently typechecks under Next 15 generated types, but the attempted Next 16 upgrade exposed type incompatibility.
- Potential impact: Framework upgrades become fragile; style blocks may block future security upgrades.
- Remediation plan:
  1. Move large style blocks to CSS modules or global CSS.
  2. Keep component-scoped styling in Tailwind/classes or typed CSS modules.
  3. Re-test after Next patch availability.

### Issue 2.4: Build could not be confirmed within the verification window
- File and lines: `package.json:10`, build script `npx cross-env NODE_NO_WARNINGS=1 next build`
- Exact flaw: `npm run build` exceeded 300 seconds and produced no final success/failure output.
- Potential impact: Operational readiness cannot be asserted even though TypeScript passes.
- Remediation plan:
  1. Run build in CI with a larger timeout and captured logs.
  2. Investigate slow static generation, remote fetches, or large routes.
  3. Add build performance budget and route-level diagnostics.

## Part 3: User Roles, Permissions, and Functional Flaws

### Issue 3.1: Middleware RBAC hid forbidden API routes but public prefixes bypassed route intent
- File and lines: `middleware.ts:182-201`
- Exact flaw: RBAC existed for role prefixes, but public API matching came first and used broad prefixes before this remediation.
- Potential impact: Public endpoints with non-GET handlers could bypass role gates.
- Remediation performed:
  1. Method-specific public allowlist added.
  2. Page content writes protected in-route.
- Remaining action: Add endpoint inventory tests for every route exporting `POST`, `PUT`, `PATCH`, or `DELETE`.

### Issue 3.2: Agent order creation previously performed best-effort stock adjustment
- File and lines: `src/app/api/agents/orders/create/route.ts:83-121`
- Exact flaw: The older route inserted orders first and deducted stock afterward with a best-effort helper. That helper used an obsolete RPC and direct `inventory.quantity` fallback.
- Potential impact: Orders could be created without stock reservation; concurrent orders could oversell; inventory ledger could diverge.
- Remediation performed:
  1. Replaced manual order insert/fallback path with `allocate_order_inventory_atomic`.
  2. The RPC creates the order and reserves inventory in one DB transaction.
  3. Removed obsolete `record_stock_movement` fallback helper.
- Remaining action: Confirm the RPC handles all agent-order fields required by the UI, especially delivery address, payment method, and order number format.

### Issue 3.3: Some admin-like endpoints still use header tokens or custom guards
- File and lines: examples from search: `src/app/api/admin/agents/list/route.ts:10`, `src/app/api/admin/redemptions/process/route.ts:10`, `src/app/api/admin/payment-settings/dedupe/route.ts:7`, `src/app/api/admin/manage-role/route.ts:18`
- Exact flaw: Multiple authorization models coexist: Supabase session roles, superadmin cookie, and `x-admin-token` / `x-internal-token` headers.
- Potential impact: Operational confusion and inconsistent privilege enforcement.
- Remediation plan:
  1. Consolidate all admin API authorization on `requireAdminContext()` or `requireApiRole({ minimumRole: 'admin' })`.
  2. Reserve header tokens only for machine-to-machine cron/webhook paths.
  3. Add route metadata documenting allowed principals.

## Part 4: Authentication Lifecycle (Signup, Login, Logout)

### Signup
- File and lines: `src/app/api/auth/signup/route.ts:10`, `src/app/auth/signup/page.tsx:213`, `src/app/auth/verify-otp/OTPVerificationContent.tsx:50`, `201`, `322`
- Exact flaw: Signup uses service-role fallback placeholders and stores signup session data in `localStorage`.
- Potential impact: Missing secret configuration can be hidden; sensitive signup context persists client-side until explicitly removed.
- Remediation plan:
  1. Enforce strict service env validation on signup API.
  2. Store transient signup state in HttpOnly cookies or server-side pending signup rows.
  3. Add duplicate account handling tests for email and phone races.

### Login
- File and lines: `src/app/api/superadmin/login/route.ts:20-27`; `src/app/api/auth/quick-login/route.ts:7-43`; `middleware.ts:47-61`
- Exact flaw: Superadmin login was missing throttling and quick-login had unsafe defaults. Middleware still validates a custom deterministic superadmin cookie.
- Potential impact: Brute force and session fixation risk if the custom cookie scheme is not rotated and invalidated server-side.
- Remediation performed:
  1. Added route throttling to superadmin login.
  2. Removed quick-login default password and external redirects.
- Remaining action:
  1. Replace custom superadmin cookie with Supabase/server-side session records.
  2. Store session ids server-side and rotate on login.
  3. Set cache-control headers on all authenticated pages.

### Logout
- File and lines: `src/store/cartStore.ts:103-157`, `486-489`, `628-635`; `src/lib/session-manager.ts:41`, `187`
- Exact flaw: Client-side logout/session cleanup relies on localStorage removal for several app states.
- Potential impact: Shared devices can retain cart, coupon, abandoned email, or signup/session residue if logout paths miss a key or fail.
- Remediation plan:
  1. Centralize logout cleanup in one tested function.
  2. Prefer server-cleared HttpOnly cookies for auth/session data.
  3. Add `Clear-Site-Data` on explicit logout if acceptable for UX.

## Part 5: CRM, Inventory, and Product Management

### CRM
- File and lines: `src/app/api/agents/orders/create/route.ts:124-154`
- Exact flaw: `ensureCustomerUser` creates or upserts profiles by email/mobile using sequential lookups.
- Potential impact: Concurrent requests for the same phone/email can create duplicate customer records unless database unique constraints exist.
- Remediation plan:
  1. Enforce unique indexes on normalized email and mobile.
  2. Replace sequential lookup/create with an idempotent database RPC.
  3. Normalize phone formats before storage and lookup.

### Inventory
- File and lines: `src/app/api/inventory/route.ts:76-130`, `147-190`; `src/app/api/inventory/transactions/route.ts:162-268`, `277-330`
- Exact flaw: Legacy inventory route used an obsolete `record_stock_movement` RPC and direct `inventory.quantity` fallback while the migration defines `inventory.stock` and `products.stock_quantity`.
- Potential impact: Race conditions, incorrect stock columns, negative/incorrect stock, and broken audit ledger.
- Remediation performed:
  1. Replaced legacy mutation fallback with `record_atomic_stock_movement`.
  2. Added quantity validation and canonical movement mapping.
  3. Mutations now use a service client after session/role authorization, with `p_created_by` audit attribution.
  4. Removed direct inventory upsert/product update fallback.
- Remaining action: Confirm `record_atomic_stock_movement` grants and service-role usage policy in production. Add concurrent checkout tests.

### Product Management
- File and lines: `src/app/api/products/csv/route.ts:5`, `40-92`; `src/app/api/admin/products/ai-add/route.ts:202-404`; `supabase/migrations/20260606000000_full_schema.sql:790-813`
- Exact flaw: CSV import depends on `csv-parse`; it was declared but missing from `node_modules` until install was repaired. Product media gatekeeper exists in DB, but API upload/AI product creation still need full file-type and image validation review.
- Potential impact: Failed imports, malformed product data, inconsistent tax/price fields, and possible asset upload abuse.
- Remediation performed:
  1. Restored npm install so `csv-parse` resolves.
  2. Typecheck now passes.
- Remaining action:
  1. Add CSV schema validation with max rows and explicit price/tax bounds.
  2. Validate image content type by magic bytes, size, dimensions, and storage path ownership.
  3. Add product creation tests for negative price, zero tax edge cases, invalid GST/HSN, and missing media.

## Part 6: Communications & Gateway Integrations (OTP & Mail)

### OTP Gateway
- File and lines: `src/app/api/otp/generate/route.ts:101-120`; `src/lib/otp-service.ts:31-32`, `48-85`, `156-256`, `271-292`; `src/lib/otp-manager.ts:564-586`, `592-603`
- Exact flaw: OTP systems are split across `OTPManager` and `OtpService`; some flows use 5-minute expiry and others 10-minute expiry. `OtpService.generateOtp` returns `otp_code`, and order status update reads it for pickup code generation.
- Test target: For `+917387375651`, the reviewed flow would normalize/format phone values in WhatsApp sending paths and rate limit by phone in `/api/otp/generate` when `OTP_RATE_LIMIT_BYPASS` is not enabled.
- Potential impact: Inconsistent expiry/attempt policies, OTP disclosure to server callers, and brute-force weaknesses if bypass flags are enabled or routes are unauthenticated.
- Remediation performed:
  1. Legacy OTP routes now require auth.
  2. Agent-order OTPs require authenticated approved sales-agent binding.
  3. Generate response no longer exposes provider raw response.
- Remaining action:
  1. Consolidate to one OTP service with one expiry and attempt policy.
  2. Never return OTP codes to API callers except a strictly internal pickup-code pre-generation path.
  3. Add brute-force tests: 4 wrong submissions lock the OTP after 3 attempts; expired OTPs fail; repeated requests for `+917387375651` hit rate limits.
  4. Store blocklist/rate limit state in a durable shared store.

### Email Gateway
- File and lines: `src/lib/email/service.ts:51-105`, `118-147`; `src/lib/improved-email-service.ts:44-60`, `68-82`, `124-226`, `249-280`, `317-374`; `src/app/api/email/verification/route.ts:13-31`
- Exact flaw: `EmailService.sendCustomEmail` forwards `to`, `cc`, `bcc`, `replyTo`, and `subject` into Nodemailer without visible CRLF/header validation. `ImprovedEmailService` sanitizes SMTP host CRLF and aligns sender, but still sends caller-provided `to` and `subject`. Email sending is synchronous, not queued.
- Test target: For `bhisaji1998@gmail.com`, the verification route validates basic email format and rate limits by user/IP, then dispatches directly to `emailHelpers.sendEmailVerification`.
- Potential impact: Header injection if caller-controlled subject/addresses reach the generic service; slow or failed SMTP requests can block API responses; no durable retry queue for transient SMTP outages.
- Remediation performed:
  1. `nodemailer` transitive installation was updated by audit fix to a non-vulnerable 8.0.10 in the lockfile.
- Remaining action:
  1. Add strict `sanitizeEmailAddress`, `sanitizeEmailHeader`, and `sanitizeDisplayName` helpers.
  2. Reject `\r` and `\n` in all envelope/header fields.
  3. Move email sends to BullMQ or another durable queue already present in dependencies.
  4. Add targeted tests dispatching to `bhisaji1998@gmail.com` with malicious subject/header payloads and assert rejection.

## Part 7: Feature-by-Feature Functional Assessment

### Public catalog and content
- Execution path: UI pages/components -> public `GET /api/products`, `GET /api/page-content`, offers/coupons/settings endpoints -> Supabase read queries.
- Current status: Partial. Public reads remain intended; non-GET public mutations are now blocked by middleware and page-content route auth.
- Hidden edge cases: `page-content` read client can still initialize service role; rich content rendering has XSS-sensitive sinks.
- Remediation: Split read/write Supabase clients; add content sanitization and endpoint method tests.

### Admin and management
- Execution path: `/mgmt/*` pages -> middleware role checks -> `/api/admin/*` routes -> Supabase service/admin clients.
- Current status: Partial.
- Hidden edge cases: Multiple guard models (`requireApiRole`, `requireAdminContext`, custom superadmin cookie, header tokens).
- Remediation: Standardize authorization; add route-level principal matrix.

### Auth, signup, and session
- Execution path: signup/signin UI -> `/api/auth/*` routes -> Supabase auth/admin APIs -> profiles and OTP tables -> client localStorage cleanup.
- Current status: Partial.
- Hidden edge cases: signup state in localStorage; placeholder service-role fallbacks; quick-login still exists behind env flag.
- Remediation: server-side pending signup state; strict env validation; remove quick-login from production.

### OTP and verification
- Execution path: OTP UI/order status -> `/api/otp/*` or order status routes -> `OTPManager`/`OtpService` -> Supabase OTP tables -> WhatsApp/email providers.
- Current status: Partial.
- Hidden edge cases: split OTP service implementations; different expiry windows; OTP code returned by `OtpService.generateOtp`.
- Remediation: consolidate OTP service, durable rate limits, and black-box brute-force tests.

### Email communications
- Execution path: `/api/email/*` routes -> `emailHelpers` -> `EmailService` or `ImprovedEmailService` -> Nodemailer primary/backup SMTP.
- Current status: Partial.
- Hidden edge cases: no durable queue; generic email service lacks visible header validation; synchronous provider calls.
- Remediation: queue emails, sanitize headers, add provider retry/backoff tests.

### Agent order creation
- Execution path: sales agent UI -> `POST /api/agents/orders/create` -> Supabase auth user -> `sales_agents` approval check -> customer resolution -> `allocate_order_inventory_atomic` RPC -> order row and stock movement rows -> commission award.
- Current status: Working but needs integration tests.
- Hidden edge cases: customer resolution race; commission award is still best-effort after order success.
- Remediation: unique customer constraints; transactional commission RPC or queued commission retry.

### Inventory
- Execution path: management UI -> `/api/inventory` or `/api/inventory/transactions` -> role guard -> service client -> `record_atomic_stock_movement` RPC -> `products.stock_quantity`, variants, `stock_movements`.
- Current status: Improved, partial pending DB verification.
- Hidden edge cases: service-role use depends on env; `transfer` is ledger-only unless warehouse location logic is implemented.
- Remediation: integration tests against Supabase branch with concurrent mutations.

### Products and imports
- Execution path: admin product UI/CSV -> `/api/products/csv`, `/api/admin/products/*` -> Supabase products/storage.
- Current status: Partial.
- Hidden edge cases: CSV numeric bounds, asset validation, AI-generated payload validation, media gatekeeper errors.
- Remediation: schema-first validation and upload scanning.

### Cart, wishlist, and customer profile
- Execution path: client stores -> localStorage -> checkout/order APIs -> Supabase.
- Current status: Partial.
- Hidden edge cases: localStorage residue after logout; stale cart merge conflicts.
- Remediation: central logout cleanup tests; server-side carts for authenticated users.

### Analytics and runtime services
- Execution path: hooks/runtime services -> sessionStorage/localStorage -> `/api/analytics/*`.
- Current status: Partial.
- Hidden edge cases: anonymous tracking state persists; public analytics endpoint must be rate limited.
- Remediation: rate limit public analytics and provide privacy retention controls.

## FINAL SUMMARY: Total Working Report

| Feature/Domain | Status (Working / Defective / Partial) | Primary Blockers / Identified Errors | Priority (High/Med/Low) |
| :--- | :--- | :--- | :--- |
| **Security & Auth** | Partial | Public mutation exposure fixed for key routes; residual service-role placeholder patterns and Next audit advisories remain. | High |
| **UI/UX & Design** | Partial | Build timed out; rich HTML rendering and regex sanitizer require hardening; responsive/browser QA not completed. | Med |
| **RBAC & Permissions** | Partial | Middleware method allowlist fixed; multiple auth models and header-token admin routes remain. | High |
| **Auth Lifecycle** | Partial | Superadmin throttling and quick-login defaults fixed; localStorage signup/session residue and custom superadmin cookie remain. | High |
| **CRM Domain** | Partial | Agent customer creation can race without DB uniqueness/RPC idempotency. | Med |
| **Inventory & Products** | Partial | Inventory mutations now atomic; product CSV/import/upload validation still needs stronger bounds and tests. | High |
| **OTP & Mail System** | Partial | OTP routes guarded; split OTP implementations, code return paths, durable rate limits, email header validation, and queueing remain. | High |
| **Other App Features** | Partial | No `test` script; build timeout; analytics/cart localStorage/privacy and integration tests pending. | Med |

### Verification Results

- `npm run typecheck`: Passed after remediation on Next 15.5.15.
- `npm test -- --run`: Failed because `package.json` has no `test` script.
- `npm audit --omit=dev --json`: Failed with 3 remaining advisories: Next, nested PostCSS under Next, and ws. The audit-suggested patch versions were not available from the registry during this run.
- `npm run build`: Timed out after 300 seconds with no remaining Next process.

### Deployment Readiness

The codebase is not ready for production deployment yet. Critical unauthenticated mutation and inventory consistency issues were reduced in this pass, but deployment should wait until the framework supply-chain advisories are patched, build completion is proven, and route-level regression tests cover the sensitive endpoints.

Top 3 critical action items:

1. Patch or mitigate the remaining Next.js advisories as soon as a compatible published version is available, then rerun typecheck, build, browser smoke tests, and `npm audit`.
2. Add automated auth/RBAC regression tests for all mutating API routes, especially service-role-backed routes.
3. Consolidate OTP/email flows with durable rate limiting, no OTP code exposure to public callers, header-injection validation, and queue-backed delivery retries.
