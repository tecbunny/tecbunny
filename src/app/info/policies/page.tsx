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
    <div className="relative overflow-hidden bg-background text-foreground">
      {/* Dynamic Background Accents */}
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-10" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-12 sm:px-6 lg:px-8 sm:pt-16">
        <Link 
          href="/" 
          className="group inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        <div className="mt-8 flex flex-col gap-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-primary sm:text-4xl">
                Legal & Compliance
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl font-tech">
                Review our policies to understand how we operate, protect your security credentials, process your data, and deliver services.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
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
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary to-blue-500 opacity-0 blur-md transition duration-500 group-hover:opacity-10" />
                  
                  <div className="relative h-full rounded-2xl border border-border bg-card p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-card/85 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted border border-border transition-colors group-hover:bg-primary/10 group-hover:border-primary/20">
                        <IconComponent className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                      </div>
                      <h2 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                        {policy.title}
                      </h2>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed font-tech">
                      {policy.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 backdrop-blur-md sm:p-8 shadow-sm">
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Need Assistance?</h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed font-tech">
                If you have questions about any of our policies, data security, or service guidelines, our team is always ready to support you.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-sm"
                >
                  Contact Support
                </Link>
                <a
                  href="mailto:support@tecbunny.com"
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-muted hover:bg-muted/80 px-5 py-2.5 text-sm font-bold text-foreground transition-all duration-300"
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
