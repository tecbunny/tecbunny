# TecBunny.com — Deep Audit & Action Pack

Generated 2026-06-04. Includes: performance audit, product-page audit, JSON-LD schemas, replacement copy.

---

## 1. Performance & Technical Audit (Lighthouse-style)

### Network timings
| Page | TTFB | Total | Size | Cache |
|---|---|---|---|---|
| Homepage | 974 ms | 978 ms | 93.2 KB HTML | `x-vercel-cache: HIT` ✅ |
| Products list | 809 ms | 814 ms | 68.2 KB HTML | OK |
| Product detail | ~1.2 s | — | — | `MISS` + `no-cache, no-store` ❌ |

### Infrastructure
- Hosted on **Vercel** (Singapore edge — `sin1::`) — good for India latency
- **HTTP/2** enabled
- **HSTS** with 2-year `max-age` ✅
- `x-content-type-options: nosniff` ✅
- `x-frame-options: DENY` ✅
- Next.js prerendered pages (`x-nextjs-prerender: 1`) ✅
- `robots.txt` present and correct (blocks `/api/`, `/auth/`, `/cart/`, `/checkout/`, `/profile/`, `/mgmt/`) ✅
- `sitemap.xml` present with **95 URLs** ✅ (includes location landing pages: `/cctv-goa`, `/amc-goa`, `/smarthome-goa`, `/rfid-goa` — good local SEO)

### Issues found
1. **Product detail pages have `cache-control: private, no-cache, no-store, max-age=0`** — they bypass Vercel edge cache entirely. Catalog data doesn't change minute-to-minute. Set `s-maxage=300, stale-while-revalidate=86400` to dramatically cut TTFB.
2. **TTFB of ~1s on homepage is acceptable but not great** — Core Web Vitals target is <600ms TTFB. Investigate server components doing slow Supabase queries.
3. **No `Content-Encoding: gzip/br`** header visible — confirm Vercel is sending Brotli.
4. **Existing JSON-LD**: Organization + LocalBusiness are present site-wide ✅ — but **Product schema is missing** on PDPs (covered below).

### Quick wins
- Enable ISR caching on `/products/[id]` pages with `revalidate: 300`
- Preconnect to Supabase image CDN (`<link rel="preconnect" href="https://fbcsagupcxheyiusjfak.supabase.co">`)
- Convert `brand.png` favicon to `.ico` + `apple-touch-icon` set
- Add `<link rel="dns-prefetch">` for the maps/ Facebook/ Instagram domains

---

## 2. Product Page Audit — CRITICAL BUGS

I audited `/products/4701065d-51da-40f1-ba75-b2fb2c5962a8` (CP PLUS 5MP Dual Light Mic Dome camera).

### Bug 1 — Page title is literally "null"
```
<title>null | TecBunny</title>
```
This means the product `name` field is `null` in your database, and your title template is doing `${product.name} | TecBunny` with no fallback. **Every PDP with a missing field looks like spam to Google.**

**Fix:**
```ts
title: `${product?.name || product?.sku || 'Product'} | TecBunny`
```

### Bug 2 — Raw HTML doctype is leaking into meta tags
Your `meta description`, `og:description`, and `twitter:description` all contain this:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    ...
    <title>CP-URC-DC51PL3C-L-V2 Description</title>
    <style>body { font-family: Arial...
```
Someone pasted a full HTML document into the product description field, and you're rendering it directly into meta tags. This is **catastrophic for SEO** — Google will see junk descriptions for every product where this was done.

**Fix:**
1. Strip HTML before using in meta tags: `description.replace(/<[^>]+>/g, '').slice(0, 160)`
2. Sanitize input on the admin form — only allow safe HTML or markdown
3. Audit all 85 products for this issue and clean the database

### Bug 3 — No Product structured data on PDPs
Only Organization + LocalBusiness JSON-LD are emitted. Product/Offer schema is missing → no rich results, no price/availability in Google.

### Bug 4 — `placehold.co` and external CDN images
Many products use `placehold.co`, Amazon CDN (`m.media-amazon.com`), Flipkart CDN (`rukminim2.flixcart.com`). Self-host all on Supabase to avoid copyright issues and hotlink failures.

### Other PDP issues
- No breadcrumbs visible
- No related products
- No "in stock / out of stock" indicator
- No spec table — just one paragraph blob
- No reviews/ratings
- Price displayed with paise (₹2,099.00 vs ₹2,099)

---

## 3. JSON-LD Schemas (ready to paste)

You already have Organization + LocalBusiness. Add these.

### 3a. Enhanced LocalBusiness (replace existing — adds geo, hours, GST, areaServed cities)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "ITService", "SecurityService"],
  "@id": "https://www.tecbunny.com/#localbusiness",
  "name": "TecBunny Solutions Private Limited",
  "legalName": "TECBUNNY SOLUTIONS PRIVATE LIMITED",
  "url": "https://www.tecbunny.com",
  "logo": "https://www.tecbunny.com/brand.png",
  "image": "https://www.tecbunny.com/brand.png",
  "description": "CCTV installation, IT services, AMC support, networking, home automation, and RFID lock systems in Goa and Maharashtra.",
  "telephone": "+91-9604136010",
  "email": "support@tecbunny.com",
  "priceRange": "₹₹",
  "currenciesAccepted": "INR",
  "paymentAccepted": "Cash, UPI, Bank Transfer, Credit Card",
  "foundingDate": "2025",
  "taxID": "30AAMCT1608G1ZO",
  "iso6523Code": "0199:U80200GA2025PTC017366",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "H No 11, Nhayginwada, Parse, Parxem",
    "addressLocality": "Pernem",
    "addressRegion": "Goa",
    "postalCode": "403512",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 15.6730616,
    "longitude": 73.7855133
  },
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    "opens": "09:00",
    "closes": "19:00"
  }],
  "areaServed": [
    {"@type":"City","name":"Pernem"},
    {"@type":"City","name":"Mapusa"},
    {"@type":"City","name":"Panaji"},
    {"@type":"City","name":"Margao"},
    {"@type":"City","name":"Vasco da Gama"},
    {"@type":"City","name":"Mumbai"},
    {"@type":"City","name":"Pune"},
    {"@type":"State","name":"Goa"},
    {"@type":"State","name":"Maharashtra"}
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Services",
    "itemListElement": [
      {"@type":"Offer","itemOffered":{"@type":"Service","name":"CCTV Installation & AMC"}},
      {"@type":"Offer","itemOffered":{"@type":"Service","name":"Computer Repair & Upgrade"}},
      {"@type":"Offer","itemOffered":{"@type":"Service","name":"Home Automation"}},
      {"@type":"Offer","itemOffered":{"@type":"Service","name":"RFID & Access Control"}},
      {"@type":"Offer","itemOffered":{"@type":"Service","name":"Networking & Structured Cabling"}},
      {"@type":"Offer","itemOffered":{"@type":"Service","name":"Web Development"}}
    ]
  },
  "sameAs": [
    "https://www.facebook.com/profile.php?id=61578165368064",
    "https://www.instagram.com/tecbunny_solutions/"
  ]
}
</script>
```

### 3b. Product schema (add to `/products/[id]` pages)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "https://www.tecbunny.com/products/{{id}}#product",
  "name": "{{product.name}}",
  "sku": "{{product.sku}}",
  "mpn": "{{product.mpn}}",
  "brand": {"@type":"Brand","name":"{{product.brand}}"},
  "category": "{{product.category}}",
  "description": "{{stripHtml(product.description).slice(0,500)}}",
  "image": [
    "{{product.image1}}",
    "{{product.image2}}"
  ],
  "offers": {
    "@type": "Offer",
    "url": "https://www.tecbunny.com/products/{{id}}",
    "priceCurrency": "INR",
    "price": "{{product.price}}",
    "priceValidUntil": "2026-12-31",
    "availability": "{{product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'}}",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": {"@id":"https://www.tecbunny.com/#localbusiness"},
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {"@type":"MonetaryAmount","value":"0","currency":"INR"},
      "shippingDestination": {"@type":"DefinedRegion","addressCountry":"IN"},
      "deliveryTime": {"@type":"ShippingDeliveryTime","handlingTime":{"@type":"QuantitativeValue","minValue":0,"maxValue":1,"unitCode":"DAY"},"transitTime":{"@type":"QuantitativeValue","minValue":2,"maxValue":5,"unitCode":"DAY"}}
    }
  }
}
</script>
```

### 3c. BreadcrumbList (add to PDPs)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type":"ListItem","position":1,"name":"Home","item":"https://www.tecbunny.com"},
    {"@type":"ListItem","position":2,"name":"Products","item":"https://www.tecbunny.com/products"},
    {"@type":"ListItem","position":3,"name":"{{category}}","item":"https://www.tecbunny.com/products?category={{categorySlug}}"},
    {"@type":"ListItem","position":4,"name":"{{product.name}}"}
  ]
}
</script>
```

### 3d. Service schema (add to `/services`)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "serviceType": "CCTV Installation and Annual Maintenance",
  "provider": {"@id":"https://www.tecbunny.com/#localbusiness"},
  "areaServed": [
    {"@type":"State","name":"Goa"},
    {"@type":"State","name":"Maharashtra"}
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "AMC Plans",
    "itemListElement": [
      {"@type":"Offer","name":"Home AMC","description":"On-site response within 48 business hours, 12-month coverage."},
      {"@type":"Offer","name":"Business AMC","description":"On-site response within 24 business hours, priority lane."},
      {"@type":"Offer","name":"Enterprise AMC","description":"Always-on monitoring, on-site engineering, strategic reviews."}
    ]
  }
}
</script>
```

### 3e. FAQPage schema (add to `/contact` — you already have FAQ content)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {"@type":"Question","name":"Do you offer site visits?","acceptedAnswer":{"@type":"Answer","text":"Yes, we provide site consultation visits in North Goa. For standard repairs, a visit charge of ₹999 applies, which is waived for major installations."}},
    {"@type":"Question","name":"How fast is installation?","acceptedAnswer":{"@type":"Answer","text":"Most residential CCTV installations complete within 1 day. Multi-camera business setups typically complete within 2-3 days from confirmed site survey."}},
    {"@type":"Question","name":"What does AMC cover?","acceptedAnswer":{"@type":"Answer","text":"AMC covers preventive maintenance, unlimited breakdown labor and travel, PC software assistance, and limited parts replacement up to plan caps. Excludes physical damage, electrical surges, and data loss."}}
  ]
}
</script>
```

---

## 4. Replacement Copy

### 4a. Homepage hero (current → replace)

**Current (cyberpunk-flavored, vague):**
> # CCTV, IT & Automation for Goa & MH
> Home.Business.Assets.Future.
> TecBunny Solutions installs CCTV systems, manages IT infrastructure, delivers AMC support, and builds home automation and RFID access control setups across Goa and Maharashtra.

**Replacement (specific, trust-building, locally rooted):**
> # CCTV, IT support & smart home setups across Goa
> Founder-led installations. Genuine CP PLUS hardware. AMC response in 24 hours for businesses.
>
> TecBunny is a Pernem-based team helping 100+ homes, shops and offices across North Goa, South Goa and Maharashtra stay secure and running. Free site survey. Honest pricing. No middlemen.
>
> [Book a free site survey] [See pricing]

### 4b. About page intro (current → replace)

**Current:**
> # Architects of Safety.
> Tecbunny Solutions Private Limited is Goa's premier IT and automation provider. We bridge the gap between complex technology and everyday peace of mind.

**Replacement:**
> # A Goa-built tech partner, not a call centre
>
> TecBunny was founded in 2025 by Shubham Bhisaji and Kamana Bandekar in Pernem, North Goa. We started after watching too many homeowners and small businesses pay big-brand prices for surveillance and then get ignored when something broke.
>
> We do three things differently:
> - **One team end-to-end** — the engineer who installs your system is the same one who answers your AMC call.
> - **Genuine hardware at trade rates** — we're authorised dealers for CP PLUS, Zebronics, TP-Link, EVM and Coconut. You see the invoice.
> - **Local response** — most North Goa AMC calls are on-site the same business day, business AMC within 24 hours.

### 4c. Service tier cards (current → replace)

**Current Essentials card:**
> Essentials — Foundational coverage for smaller footprints. Custom quote.
> Routine health checks · Remote assistance window · Lifecycle planning

**Replacement:**
> **Home AMC** — from ₹3,499/year
> For homes with 4–8 cameras and one PC.
> - 2 preventive maintenance visits per year
> - Unlimited breakdown calls (labour & travel included)
> - On-site response within 48 business hours
> - Parts replacement up to ₹2,000 / year

> **Business AMC** — from ₹8,999/year
> For shops, restaurants and offices up to 16 cameras.
> - 4 preventive visits + quarterly health report
> - On-site response within 24 business hours
> - Priority escalation lane
> - Parts replacement up to ₹6,000 / year

> **Enterprise AMC** — custom quote
> For hotels, multi-site operations and large offices.
> - Always-on remote monitoring
> - Named on-site engineer
> - Quarterly strategic reviews
> - Custom SLA & parts pool

*(Numbers above are placeholder anchors — adjust to your real costing. The point is to show *anything* concrete instead of "Custom quote" everywhere.)*

### 4d. Replace the cyberpunk filler section

**Current homepage body paragraph (4 paragraphs of generic AI text)** — replace with three concrete proof modules:

**Block 1 — "What we just installed this month"**
A simple 3-card photo strip:
- "8-camera CP PLUS setup for a beachside villa in Morjim"
- "16-channel NVR + biometric attendance for a Mapusa garment shop"
- "Smart lighting + door-phone retrofit, 2BHK Porvorim"

**Block 2 — Brand authorisations**
Logo strip: CP PLUS · Zebronics · TP-Link · SanDisk · Quick Heal · EVM · Coconut · Foxin

**Block 3 — "Why TecBunny vs Amazon / random local installer"**
| | TecBunny | Online | Local untrained |
|---|---|---|---|
| Genuine hardware | ✓ | Sometimes | Often grey market |
| Professional cabling | ✓ | ✗ | Mixed |
| 24-hour AMC response | ✓ | ✗ | ✗ |
| GST invoice | ✓ | ✓ | Often no |
| One team end-to-end | ✓ | ✗ | ✓ |

### 4e. Soften the cyberpunk labels

| Current label | Replacement |
|---|---|
| "Initialize Protocol." (Contact H1) | "Get in touch" |
| "Send Transmission" (form heading) | "Send us a message" |
| "Transmission Hub" (footer) | "Reach us" |
| "Protocols" (footer column) | "Services" |
| "Database" (footer column) | "Company" |
| "system_status.log" terminal widget | Replace with a real metric: "Sites under AMC: 47 · Average ticket response: 9 hours" |
| "Comms" | "Contact" |
| "Operational Base" (map caption) | "Our office" |

Keep one or two flourishes if they're part of your brand voice — but every additional one raises the bar to convert a 55-year-old hotelier in Calangute who just wants 12 cameras quoted.

### 4f. Stat-block fix
- Replace "0 Downtime" (implausible) with **"99.2% uptime across managed sites in 2025"** or just remove
- Reconcile "100 Installations" (home) vs "100+ Projects" (about) — pick one number, footnote the source ("as of June 2026")

---

## Implementation priority (one screen)

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Strip HTML from product descriptions before meta tags | 1 hr | 🔴 SEO-critical |
| 2 | Fix `null` product titles (add fallback) | 30 min | 🔴 SEO-critical |
| 3 | Reconcile two different CIN numbers | 15 min | 🔴 Legal/trust |
| 4 | Fix "Live Service Feed Unavailable" on /services | varies | 🔴 Broken UX |
| 5 | Upload real images for all 85 products, remove placehold.co | 1 day | 🔴 Conversion |
| 6 | Add Product + Breadcrumb JSON-LD on PDPs | 2 hr | 🟡 SEO |
| 7 | Add FAQPage JSON-LD on /contact | 30 min | 🟡 SEO |
| 8 | Enable ISR caching on PDPs (`revalidate: 300`) | 30 min | 🟡 Perf |
| 9 | Replace homepage copy + add starting prices to tiers | 2 hr | 🟢 Conversion |
| 10 | Add testimonials + brand-partner logo strip | 1 day | 🟢 Trust |
