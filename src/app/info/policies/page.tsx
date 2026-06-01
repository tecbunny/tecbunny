import Link from 'next/link';
import { ArrowLeft, FileText, Shield, Truck, RotateCcw, Undo2 } from 'lucide-react';

import { Metadata } from 'next';


// Static metadata for better SEO and performance
export const metadata: Metadata = {
  title: 'Policies - TecBunny Store',
  description: 'Read our privacy policy, terms of service, shipping information, and return policy.',
  keywords: ['policies', 'privacy', 'terms', 'shipping', 'returns', 'TecBunny'],
  openGraph: {
    title: 'Policies - TecBunny Store',
    description: 'Read our privacy policy, terms of service, shipping information, and return policy.',
    type: 'website',
  },
};

// Force static generation
// export const dynamic = 'force-static';

export default function PoliciesPage() {
  const policies = [
    {
      title: 'Privacy Policy',
      description: 'Learn how we collect, use, and protect your personal information',
      icon: Shield,
      href: '/info/policies/privacy',
      color: 'text-blue-600',
    },
    {
      title: 'Terms of Service',
      description: 'Understand the terms and conditions of using our platform',
      icon: FileText,
      href: '/info/policies/terms',
      color: 'text-green-600',
    },
    {
      title: 'Shipping Policy',
      description: 'Information about shipping methods, costs, and delivery times',
      icon: Truck,
      href: '/info/policies/shipping',
      color: 'text-orange-600',
    },
    {
      title: 'Return Policy',
      description: 'Guidelines for returns, exchanges, and refunds',
      icon: RotateCcw,
      href: '/info/policies/return',
      color: 'text-red-600',
    },
    {
      title: 'Refund & Cancellation Policy',
      description: 'How cancellations work and when refunds are completed',
      icon: Undo2,
      href: '/info/policies/refund-cancellation',
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200">
      {/* Dynamic Background Accents */}
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-10" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-12 sm:px-6 lg:px-8 sm:pt-16">
        <Link 
          href="/" 
          className="group inline-flex items-center text-sm font-medium text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        <div className="mt-8 flex flex-col gap-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-white/5 pb-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-cyan-300 sm:text-4xl">
                Legal & Compliance
              </h1>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-2xl">
                Review our policies to understand how we operate, protect your security credentials, process your data, and deliver services.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Last updated: Jan 2026
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {policies.map((policy) => {
              const IconComponent = policy.icon;
              return (
                <Link key={policy.href} href={policy.href} className="group relative">
                  {/* Neon Glow Hover Effect */}
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 opacity-0 blur-md transition duration-500 group-hover:opacity-10" />
                  
                  <div className="relative h-full rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-slate-900/60 shadow-[0_0_30px_rgba(6,182,212,0.02)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/5 transition-colors group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20">
                        <IconComponent className="h-5 w-5 text-cyan-300 transition-transform group-hover:scale-110" />
                      </div>
                      <h2 className="text-lg font-bold text-white transition-colors group-hover:text-cyan-300">
                        {policy.title}
                      </h2>
                    </div>
                    <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                      {policy.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/85 to-slate-900/45 p-6 backdrop-blur-md sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.03)]">
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative">
              <h2 className="text-xl font-bold text-white sm:text-2xl">Need Assistance?</h2>
              <p className="mt-2 text-sm text-slate-400 max-w-xl leading-relaxed">
                If you have questions about any of our policies, data security, or service guidelines, our team is always ready to support you.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_20px_rgba(34,211,238,0.45)] hover:bg-white transition-all duration-300"
                >
                  Contact Support
                </Link>
                <a
                  href="mailto:support@tecbunny.com"
                  className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 px-5 py-2.5 text-sm font-bold text-white transition-all duration-300"
                >
                  Email Legal Team
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
