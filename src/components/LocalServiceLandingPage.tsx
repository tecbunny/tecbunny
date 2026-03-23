'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, Cctv, CheckCircle2, Clock3, Lock, MapPin, MessageSquare, PhoneCall, Shield, ShieldCheck, Wifi, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAnalytics } from '../hooks/use-analytics';

interface FaqItem {
  question: string;
  answer: string;
}

interface LocalServiceLandingPageProps {
  badge: string;
  title: string;
  description: string;
  locationLabel: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  heroHighlights: string[];
  audience: string[];
  deliverables: string[];
  process: string[];
  faqs: FaqItem[];
  iconName: 'shield' | 'cctv' | 'wifi' | 'lock';
  eventPrefix: string;
}

const heroIconMap: Record<LocalServiceLandingPageProps['iconName'], LucideIcon> = {
  shield: Shield,
  cctv: Cctv,
  wifi: Wifi,
  lock: Lock,
};

export default function LocalServiceLandingPage({
  badge,
  title,
  description,
  locationLabel,
  primaryCtaLabel,
  primaryCtaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  heroHighlights,
  audience,
  deliverables,
  process,
  faqs,
  iconName,
  eventPrefix,
}: LocalServiceLandingPageProps) {
  const { trackEvent } = useAnalytics();
  const HeroIcon = heroIconMap[iconName];

  const stats = useMemo(
    () => [
      { label: 'Response window', value: 'Same business day', icon: Clock3 },
      { label: 'Coverage', value: locationLabel, icon: MapPin },
      { label: 'Support line', value: '+91 96041 36010', icon: PhoneCall },
    ],
    [locationLabel]
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-[32rem] w-[48rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[140px]" />

      <section className="relative border-b border-white/5 px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              <HeroIcon className="h-4 w-4" />
              {badge}
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-base text-slate-400 sm:text-lg">{description}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                <Link
                  href={primaryCtaHref}
                  onClick={() => trackEvent(`${eventPrefix}_primary_cta_click`, { cta: primaryCtaLabel })}
                >
                  {primaryCtaLabel}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/10 text-slate-200 hover:bg-white/10">
                <Link
                  href={secondaryCtaHref}
                  onClick={() => trackEvent(`${eventPrefix}_secondary_cta_click`, { cta: secondaryCtaLabel })}
                >
                  {secondaryCtaLabel}
                </Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
              {heroHighlights.map((highlight) => (
                <span key={highlight} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                  {highlight}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Local project intake</p>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Lead-ready workflow</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {stats.map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <StatIcon className="h-4 w-4 text-cyan-300" />
                    <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">{stat.label}</p>
                    <p className="mt-2 text-sm font-medium text-white">{stat.value}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-semibold text-white">What happens next</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-3">
                  <ArrowRight className="mt-0.5 h-4 w-4 text-cyan-300" />
                  We confirm your requirement and recommend the right scope.
                </li>
                <li className="flex items-start gap-3">
                  <ArrowRight className="mt-0.5 h-4 w-4 text-cyan-300" />
                  A TecBunny specialist shares survey, quote, or demo details.
                </li>
                <li className="flex items-start gap-3">
                  <ArrowRight className="mt-0.5 h-4 w-4 text-cyan-300" />
                  Deployment follows only after scope approval.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-8">
            <h2 className="text-2xl font-semibold text-white">Best fit for</h2>
            <ul className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {audience.map((item) => (
                <li key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-8">
            <h2 className="text-2xl font-semibold text-white">What TecBunny delivers</h2>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              {deliverables.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-slate-900/50 p-8">
          <h2 className="text-2xl font-semibold text-white">How the engagement works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {process.map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Step {index + 1}</p>
                <p className="mt-3 text-sm text-slate-300">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-slate-900/50 p-8">
          <h2 className="text-2xl font-semibold text-white">FAQs</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-base font-medium text-white">{faq.question}</p>
                <p className="mt-3 text-sm text-slate-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 p-8 text-center">
          <h2 className="text-3xl font-semibold text-white">Need a fast local response?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300">
            Use the quote form for scope details or reach TecBunny directly on WhatsApp for urgent coordination.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              <Link
                href={primaryCtaHref}
                onClick={() => trackEvent(`${eventPrefix}_footer_primary_cta_click`, { cta: primaryCtaLabel })}
              >
                {primaryCtaLabel}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/10 text-slate-200 hover:bg-white/10">
              <Link
                href="https://wa.me/919604136010"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent(`${eventPrefix}_whatsapp_click`, { destination: 'whatsapp' })}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat on WhatsApp
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}