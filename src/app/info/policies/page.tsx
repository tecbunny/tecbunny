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
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-12 sm:px-6 lg:px-8 sm:pt-16">
        <Link href="/" className="inline-flex items-center text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        <div className="mt-8 flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">Legal & Compliance</h1>
              <p className="mt-2 text-sm text-slate-400">
                Review our policies to understand how we operate, protect your data, and deliver services.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              Last updated: Jan 2026
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {policies.map((policy) => {
              const IconComponent = policy.icon;
              return (
                <Link key={policy.href} href={policy.href} className="group">
                  <div className="h-full rounded-2xl border border-white/10 bg-slate-900/70 p-6 transition-colors group-hover:border-cyan-400/40">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                        <IconComponent className="h-5 w-5 text-cyan-300" />
                      </div>
                      <h2 className="text-lg font-semibold text-white">{policy.title}</h2>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">{policy.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Need Help?</h2>
            <p className="mt-2 text-sm text-slate-400">
              If you have questions about any of our policies, please don&apos;t hesitate to contact us.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200"
              >
                Contact Support
              </Link>
              <a
                href="mailto:support@tecbunny.com"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
              >
                Email Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
