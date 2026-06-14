import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  Code, 
  LayoutDashboard, 
  MessageCircle, 
  Palette, 
  Files, 
  CheckCircle2,
  ArrowRight,
  Sparkles
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Web Development Services in Goa & Maharashtra',
  description: 'Custom business websites, e-commerce storefronts, admin dashboards, and WhatsApp-integrated web development for companies in Goa and Maharashtra.',
  keywords: ['web development Goa', 'website design Goa', 'business website Maharashtra', 'ecommerce website Goa', 'custom web app TecBunny'],
  path: '/webdev',
  image: '/brand.png',
});

export default function WebDevPage() {
  const features = [
    {
      title: "WhatsApp Integration",
      description: "Direct customer communication integrated right into your website.",
      icon: MessageCircle,
    },
    {
      title: "Unique Design",
      description: "Custom-crafted designs tailored to your brand. We don't use common templates.",
      icon: Palette,
    },
    {
      title: "Admin Dashboard",
      description: "Easy-to-use backend for managing your content and viewing analytics.",
      icon: LayoutDashboard,
    },
    {
      title: "Multiple Pages",
      description: "Comprehensive multi-page structure to showcase all aspects of your business.",
      icon: Files,
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#09090B] text-zinc-200 selection:bg-blue-500/20 selection:text-white overflow-hidden py-16 sm:py-24">
      {/* Background Noise and Grid (unified style) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute -left-40 top-0 h-[42rem] w-[42rem] rounded-full bg-blue-500/5 blur-[160px]" />
        <div className="absolute -right-40 top-1/3 h-[46rem] w-[46rem] rounded-full bg-indigo-500/5 blur-[180px]" />
      </div>

      {/* Ambient Blobs */}
      <div className="ambient-blob pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px] animate-pulse" aria-hidden="true" />
      <div className="ambient-blob ambient-blob--delayed pointer-events-none absolute right-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]" aria-hidden="true" />

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-6 sm:px-8">
        {/* Hero Section */}
        <section className="reveal-section text-center space-y-6 max-w-3xl mx-auto" data-reveal-id="webdev-hero">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4.5 py-1.5 text-xs font-semibold text-blue-400">
            <Sparkles size={14} className="animate-pulse" />
            <span>Professional Web Solutions</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl font-tech leading-tight tech-heading">
            Professional <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent">Web Development</span>
          </h1>
          <p className="text-lg font-light leading-relaxed tech-body">
            Architect your digital presence with our expert web engineering services. Custom solutions designed to scale for modern businesses.
          </p>
          <div className="flex flex-wrap gap-4 pt-4 justify-center">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-550 text-white font-bold rounded-xl px-8 shadow-[0_0_20px_-5px_rgba(59,130,246,0.35)] transition-all">
              <Link href="/contact?subject=web_development">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="border-zinc-800 bg-zinc-900/30 text-white hover:bg-white/10 hover:border-zinc-700 rounded-xl px-8 transition-all">
              <Link href="/services">View All Services</Link>
            </Button>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-12 md:py-16">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7 space-y-6">
              <span className="text-xs uppercase tracking-[0.45em] text-blue-500 font-bold">Capabilities</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white font-tech leading-tight">
                Web Engineering Services
              </h2>
              <p className="text-zinc-400 text-sm font-light leading-relaxed">
                We create robust, scalable, and secure websites that drive growth. From landing pages to complex web applications, we handle it all. In fact, this web platform you are viewing right now is engineered by us—a live example of our capabilities.
              </p>
              <ul className="grid gap-4 mt-6">
                {[
                  "Responsive Mobile-First Design",
                  "SEO Optimization Ready",
                  "Fast Loading Speeds & Premium Performance",
                  "Secure & Reliable Hosting Setup"
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3 text-zinc-300 text-sm font-light">
                    <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-5 bento-card p-12 flex items-center justify-center min-h-[300px]">
                 <Code className="h-28 w-28 text-blue-400/20" />
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-12 md:py-16">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <span className="text-xs uppercase tracking-[0.45em] text-blue-500 font-bold">Why Us</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-tech tracking-tight">
              Why Choose Our Web Solutions?
            </h2>
            <p className="max-w-[700px] text-zinc-400 text-sm sm:text-base font-light">
              We deliver more than just a website; we deliver a complete digital business tool.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bento-card p-6 flex flex-col justify-between transition-all duration-300">
                <div>
                  <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-white font-tech mb-2">{feature.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-light">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-16">
          <div className="relative bg-gradient-to-br from-blue-600 via-indigo-900 to-zinc-950 rounded-3xl p-8 md:p-16 text-center text-white shadow-2xl overflow-hidden border border-blue-500/20">
            {/* Visual gradient overlays */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35),_transparent)] pointer-events-none" />
            
            <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-tech">
                Ready to Ship Your Website?
              </h2>
              <p className="text-zinc-200 text-base md:text-lg font-light leading-relaxed">
                Contact us today to discuss your project requirements and get a custom proposal.
              </p>
              <div className="flex justify-center pt-4">
                <Button asChild size="lg" variant="secondary" className="bg-white hover:bg-zinc-100 text-zinc-950 font-bold rounded-xl px-8 shadow-md">
                  <Link href="/contact?subject=web_development" className="flex items-center gap-2">
                    Contact Us Now <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
