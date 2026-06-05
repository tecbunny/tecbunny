'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
      <div className="pointer-events-none absolute top-20 right-20 h-96 w-96 rounded-full bg-cyan-500/10 blur-[110px]" />

      <section className="relative pb-20 pt-0 sm:pt-0">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Est. 2025 • Goa
          </div>
          <h1 className="mt-6 text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
            Architects of{' '}
            <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">
              Safety.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
            Tecbunny Solutions Private Limited is Goa&apos;s premier IT and automation provider. We bridge the gap between complex technology and everyday peace of mind.
          </p>
        </div>
      </section>

      <section className="border-y border-white/5 bg-white/5 py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-cyan-500/40 to-violet-500/40 opacity-20 blur-2xl" />
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/70 p-8">
              <h3 className="text-2xl font-semibold text-white">Our Mission</h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                To transform homes and businesses in Goa into smart, secure sanctuaries. We believe high-tech security shouldn&apos;t be a luxury—it should be an accessible standard. By combining aggressive pricing with expert local support, we remove the barriers to entry for modern surveillance and automation.
              </p>
              <div className="mt-6 flex gap-4">
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center">
                  <span className="block text-xl font-semibold text-white">120+</span>
                  <span className="text-xs uppercase tracking-widest text-slate-500">Projects</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center">
                  <span className="block text-xl font-semibold text-white">99.9%</span>
                  <span className="text-xs uppercase tracking-widest text-slate-500">Uptime SLA</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-white">The Core Philosophy</h2>
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">🏷️</div>
              <div>
                <h4 className="text-lg font-semibold text-white">Radical Affordability</h4>
                <p className="mt-1 text-sm text-slate-400">Enterprise-grade hardware priced to undercut traditional retail.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">🛠️</div>
              <div>
                <h4 className="text-lg font-semibold text-white">Service-First Approach</h4>
                <p className="mt-1 text-sm text-slate-400">Professional installation, tailored setup, and reliable AMC support.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">🏠</div>
              <div>
                <h4 className="text-lg font-semibold text-white">Retrofit Focus</h4>
                <p className="mt-1 text-sm text-slate-400">Wireless and minimally invasive installations for existing homes.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Leadership</span>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Meet the Founders</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
              <div className="flex items-center gap-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 text-2xl font-bold text-cyan-300 font-tech shadow-lg shadow-cyan-500/5">
                  SB
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Shubham Sakharam Bhisaji</h3>
                  <p className="text-sm font-medium text-cyan-300">Director & Co-Founder</p>
                  <div className="mt-2 flex gap-2 text-xs text-slate-500">
                    <span className="rounded bg-white/5 px-2 py-1">TECH_LEAD</span>
                    <span className="rounded bg-white/5 px-2 py-1">OPS</span>
                  </div>
                </div>
              </div>
              <p className="mt-6 border-t border-white/5 pt-6 text-sm text-slate-400 italic">
                “Security isn&apos;t just about cameras; it&apos;s about the confidence to live freely.”
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
              <div className="flex items-center gap-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 text-2xl font-bold text-violet-300 font-tech shadow-lg shadow-violet-500/5">
                  KB
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Kamana Ashok Bandekar</h3>
                  <p className="text-sm font-medium text-violet-300">Director & Co-Founder</p>
                  <div className="mt-2 flex gap-2 text-xs text-slate-500">
                    <span className="rounded bg-white/5 px-2 py-1">STRATEGY</span>
                    <span className="rounded bg-white/5 px-2 py-1">FINANCE</span>
                  </div>
                </div>
              </div>
              <p className="mt-6 border-t border-white/5 pt-6 text-sm text-slate-400 italic">
                “We build systems that work for you, not the other way around.”
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/5 py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 text-center sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">🏛️</div>
            <h4 className="text-lg font-semibold text-white">Registered Entity</h4>
            <p className="mt-2 text-sm text-slate-400">Tecbunny Solutions Private Limited</p>
            <p className="mt-3 inline-block rounded bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-300">CIN: U80200GA2025PTC017488</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">📍</div>
            <h4 className="text-lg font-semibold text-white">Headquarters</h4>
            <p className="mt-2 text-sm text-slate-400">Parse, Pernem<br />North Goa, 403512</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">🤝</div>
            <h4 className="text-lg font-semibold text-white">Support</h4>
            <p className="mt-2 text-sm text-slate-400">Local Goa-based Team</p>
            <Link href="/contact" className="mt-3 inline-block text-xs font-semibold text-cyan-300">
              Get in touch →
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-white">Get in Touch</h2>
            <p className="mt-3 text-sm text-slate-400">Ready to connect? We&apos;re here to help you with all your technology needs.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
              <h3 className="text-lg font-semibold text-white">WhatsApp Us</h3>
              <p className="mt-2 text-sm text-slate-400">Quick responses for urgent queries</p>
              <a
                href="https://wa.me/919604136010"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white"
              >
                Chat Now
              </a>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
              <h3 className="text-lg font-semibold text-white">Email Us</h3>
              <p className="mt-2 text-sm text-slate-400">For detailed inquiries and support</p>
              <a
                href="mailto:support@tecbunny.com"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-500 px-5 py-2 text-sm font-semibold text-white"
              >
                Send Email
              </a>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
              <h3 className="text-lg font-semibold text-white">Visit Us</h3>
              <p className="mt-2 text-sm text-slate-400">Parcem, Pernem, Goa - 403512</p>
              <p className="mt-1 text-xs text-slate-500">GST No: 30AAMCT1608G1ZO</p>
              <a
                href="https://maps.app.goo.gl/HZDjt3zoB1Rcrjqp8"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white"
              >
                Get Directions
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-900 py-16 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold text-white">Ready to Experience the Difference?</h2>
          <p className="mt-3 text-sm text-slate-400">Join thousands of satisfied customers who trust Tecbunny for their technology needs.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/products" className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900">
              Shop Now
            </Link>
            <Link href="/contact" className="rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
