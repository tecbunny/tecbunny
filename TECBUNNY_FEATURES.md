# TecBunny Platform - End-to-End Architectural Journey

This document provides a chronological architectural mapping of the TecBunny ecosystem, detailing exactly how the platform modules are wired together from the moment a user signs up to post-purchase feedback and servicing.

## Phase 1: Onboarding & Authentication
The journey begins at registration, tightly guarded by security layers.
1. **Bot Protection Check**: The signup form (`/auth/signup`) is guarded by Cloudflare Turnstile (`react-turnstile`). Payload verification happens server-side via `/api/captcha/verify`.
2. **Account Creation**: User details are passed to Supabase Auth.
3. **Multi-Factor Verification**: 
   - **OTP Engine**: The `otp-manager.ts` handles email/SMS code generation and validation via `/api/auth/verify-otp`.
   - **First-Login Handshake**: Upon successful verification, `/api/auth/first-login-whatsapp` fires an automated welcome message and onboarding sequence through Infobip's WhatsApp API.
4. **Cart Hydration**: If the user browsed as a guest, the Zustand global state (`cartStore.ts`) triggers `mergeGuestCartWithUserCart()`, migrating local `tecbunny_cart_guest` items seamlessly to their authenticated session profile.

## Phase 2: Discovery & Catalog Browsing
With the session secured via the `tb-user-role-cache` middleware cookie, the user interacts with the catalog.
1. **Dynamic Rendering**: Products are fetched server-side (Next.js App Router).
2. **AI Enrichment**: Product descriptions and associated "Related Products" are generated or optimized dynamically using Gemini LLM models (`gemini-service.ts`, `/api/admin/ai/related-products`).
3. **Custom Builder**: The user enters the `/customised-setups` builder. The React flow prevents hardware conflicts and utilizes `custom-setup-pricing.ts` to calculate real-time aggregate pricing.
4. **Attribution**: If the user arrived via an affiliate link, middleware tracks the `ref` URL parameter and drops a 7-day `tb_source_context` cookie.

## Phase 3: The Commerce Engine (Cart & Offers)
The user adds items to their cart, engaging the platform's core mathematics.
1. **State Persistence**: The `cartStore.ts` writes changes to `localStorage` and continuously evaluates session idleness. If idle for 15 minutes, a cron-like trigger hits `/api/email/abandoned-cart`.
2. **Dynamic Pricing Hydration**: The UI silently pings `/api/checkout/calculate`.
3. **Offer Engine**: `/api/auto-offers` scans the cart subtotal and user tier (e.g., B2B Gold vs Standard B2C) and auto-applies relevant discounts.
4. **Proportional Distribution**: The `checkout-engine.ts` distributes the total applied discount weight down to the exact paisa across all cart line items to prepare for legal tax deduction.

## Phase 4: Checkout & Transaction
1. **Stock Pre-Flight Validation**: At checkout initiation, the engine forcefully compares cart quantities against real-time database stock levels (`stock_quantity`).
2. **Forward GST Computation**: The engine deduces the exclusive item price from the inclusive post-discount total to accurately assign CGST/SGST per Indian tax laws.
3. **Payment Handoff**: The payload is securely signed and routed to `/api/payment/payu`. The user completes the transaction off-site.
4. **Webhook Processing**: PayU triggers the `/api/webhooks` endpoint. The payload is cryptographically validated (`webhook-validator.ts`), and the system upgrades the order status to `Payment Confirmed`.

## Phase 5: Fulfillment, Operations & Invoicing
1. **Notifications Dispatch**: The `webhook-logger.ts` triggers `improved-email-service.ts` to send a NodeMailer HTML receipt and `whatsapp-service.ts` for an SMS alert.
2. **Admin Pipeline**: The order appears in the `/mgmt/sales` portal. Staff members manually shift statuses from `Processing` to `Shipped` to `Delivered`.
3. **Automated Invoicing**: `pdf-generator.ts` uses `pdfkit` to compile a programmatic, GST-compliant tax invoice. This PDF is uploaded to AWS S3 (`s3-storage.ts`), and the URL is appended to the order record.
4. **Commission Allocation**: The `enhanced-commission-service.ts` detects the original `tb_source_context` cookie. It calculates agent commission rules and awards ledger points to the affiliate agent's balance.

## Phase 6: Post-Purchase, Servicing & Feedback
The relationship lifecycle continues after delivery.
1. **Warranty Registration**: Users can register serial numbers via `/activate-warranty/[serialNumber]`, binding specific hardware units to their profile via `/api/admin/inventory/warranty/register`.
2. **Service Ticketing**: If an issue arises, the user creates a Service Ticket.
3. **Engineer Dispatch**: A manager assigns a `service_engineer` role to the ticket. The engineer uses the portal to update statuses, inject spare parts costs (`ServicePart`), and mark the ticket `Completed`.
4. **Feedback & Retention Cron**:
   - The `/api/cron/service-retention` background job routinely scans completed service tickets.
   - It fires automated emails/WhatsApp messages asking for a 1-5 star review and text feedback, which populates the `customer_rating` and `customer_feedback` schemas.
5. **Analytics Intake**: All touchpoints (sales, feedback, returns) are vacuumed into `CustomerAnalytics` arrays to dynamically adjust the user's internal `loyalty_score` and `risk_score` for future interactions.
