'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
      <div className="pointer-events-none absolute top-20 right-20 h-96 w-96 rounded-full bg-primary/10 blur-[110px]" />

      <section className="relative pb-20 pt-20 sm:pt-28">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Est. 2025 • Goa
          </div>
          <h1 className="mt-6 text-4xl font-semibold sm:text-5xl lg:text-6xl tech-heading">
            Architects of{' '}
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              Safety.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Tecbunny Solutions Private Limited is Goa&apos;s premier IT and automation provider. We bridge the gap between complex technology and everyday peace of mind.
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-muted/10 py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-primary/40 to-primary/10 opacity-20 blur-2xl" />
            <div className="relative bento-card p-8">
              <h3 className="text-2xl font-semibold tech-heading">Our Mission</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                To transform homes and businesses in Goa into smart, secure sanctuaries. We believe high-tech security shouldn&apos;t be a luxury—it should be an accessible standard. By combining aggressive pricing with expert local support, we remove the barriers to entry for modern surveillance and automation.
              </p>
              <div className="mt-6 flex gap-4">
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
                  <span className="block text-xl font-semibold text-foreground">120+</span>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Projects</span>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
                  <span className="block text-xl font-semibold text-foreground">99.9%</span>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Uptime SLA</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tech-heading">The Core Philosophy</h2>
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">🏷️</div>
              <div>
                <h4 className="text-lg font-semibold tech-heading">Radical Affordability</h4>
                <p className="mt-1 text-sm text-muted-foreground">Enterprise-grade hardware priced to undercut traditional retail.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">🛠️</div>
              <div>
                <h4 className="text-lg font-semibold tech-heading">Service-First Approach</h4>
                <p className="mt-1 text-sm text-muted-foreground">Professional installation, tailored setup, and reliable AMC support.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">🏠</div>
              <div>
                <h4 className="text-lg font-semibold tech-heading">Retrofit Focus</h4>
                <p className="mt-1 text-sm text-muted-foreground">Wireless and minimally invasive installations for existing homes.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Leadership</span>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl tech-heading">Meet the Founders</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="bento-card p-6">
              <div className="flex items-center gap-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/10 text-2xl font-bold text-primary font-tech">
                  SB
                </div>
                <div>
                  <h3 className="text-xl font-semibold tech-heading">Shubham Sakharam Bhisaji</h3>
                  <p className="text-sm font-medium text-primary">Director & Co-Founder</p>
                  <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-2 py-1">TECH_LEAD</span>
                    <span className="rounded bg-muted px-2 py-1">OPS</span>
                  </div>
                </div>
              </div>
              <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground italic">
                “Security isn&apos;t just about cameras; it&apos;s about the confidence to live freely.”
              </p>
            </div>

            <div className="bento-card p-6">
              <div className="flex items-center gap-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/10 text-2xl font-bold text-primary font-tech">
                  KB
                </div>
                <div>
                  <h3 className="text-xl font-semibold tech-heading">Kamana Ashok Bandekar</h3>
                  <p className="text-sm font-medium text-primary">Director & Co-Founder</p>
                  <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-2 py-1">STRATEGY</span>
                    <span className="rounded bg-muted px-2 py-1">FINANCE</span>
                  </div>
                </div>
              </div>
              <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground italic">
                “We build systems that work for you, not the other way around.”
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/10 py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 text-center sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="bento-card p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">🏛️</div>
            <h4 className="text-lg font-semibold tech-heading">Registered Entity</h4>
            <p className="mt-2 text-sm text-muted-foreground">Tecbunny Solutions Private Limited</p>
            <p className="mt-3 inline-block rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">CIN: U80200GA2025PTC017488</p>
          </div>
          <div className="bento-card p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">📍</div>
            <h4 className="text-lg font-semibold tech-heading">Headquarters</h4>
            <p className="mt-2 text-sm text-muted-foreground">Parse, Pernem<br />North Goa, 403512</p>
          </div>
          <div className="bento-card p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">🤝</div>
            <h4 className="text-lg font-semibold tech-heading">Support</h4>
            <p className="mt-2 text-sm text-muted-foreground">Local Goa-based Team</p>
            <Link href="/contact" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
              Get in touch →
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tech-heading">Get in Touch</h2>
            <p className="mt-3 text-sm text-muted-foreground">Ready to connect? We&apos;re here to help you with all your technology needs.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="bento-card p-6 text-center">
              <h3 className="text-lg font-semibold tech-heading">WhatsApp Us</h3>
              <p className="mt-2 text-sm text-muted-foreground">Quick responses for urgent queries</p>
              <a
                href="https://wa.me/919604136010"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary/90 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                Chat Now
              </a>
            </div>
            <div className="bento-card p-6 text-center">
              <h3 className="text-lg font-semibold tech-heading">Email Us</h3>
              <p className="mt-2 text-sm text-muted-foreground">For detailed inquiries and support</p>
              <a
                href="mailto:support@tecbunny.com"
                className="mt-5 inline-flex items-center justify-center rounded-lg border border-border bg-muted/20 hover:bg-muted/40 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors"
              >
                Send Email
              </a>
            </div>
            <div className="bento-card p-6 text-center">
              <h3 className="text-lg font-semibold tech-heading">Visit Us</h3>
              <p className="mt-2 text-sm text-muted-foreground">Parcem, Pernem, Goa - 403512</p>
              <p className="mt-1 text-xs text-muted-foreground">GST No: 30AAMCT1608G1ZO</p>
              <a
                href="https://maps.app.goo.gl/HZDjt3zoB1Rcrjqp8"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center rounded-lg border border-border bg-muted/20 hover:bg-muted/40 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors"
              >
                Get Directions
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-16 text-center border-t border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold tech-heading">Ready to Experience the Difference?</h2>
          <p className="mt-3 text-sm text-muted-foreground">Join local businesses and homeowners who trust Tecbunny for their technology needs.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/products" className="rounded-lg bg-primary hover:bg-primary/90 px-6 py-3 text-sm font-semibold text-white transition-colors">
              Shop Now
            </Link>
            <Link href="/contact" className="rounded-lg border border-border bg-muted/20 hover:bg-muted/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
