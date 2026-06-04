'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { LucideProps } from 'lucide-react';
import {
  Award,
  Cctv,
  Code,
  Cpu,
  HeadphonesIcon,
  RefreshCw,
  Shield,
  ShoppingCart,
  Truck,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn, revealDelayClass } from '@/lib/utils';
import { useCart } from '@/lib/hooks';
import { useAnalytics } from '../hooks/use-analytics';
import { usePermissions } from '../hooks/use-permissions';
import { useRevealSections } from '../hooks/use-reveal-sections';
import type { Product, Service } from '@/lib/types';
import HeroCarousel from './HeroCarousel';


const iconMap: Record<string, ComponentType<LucideProps>> = {
  Wrench,
  Shield,
  Truck,
  HeadphonesIcon,
  RefreshCw,
  Award,
  Cctv,
  Cpu,
  Code,
};

interface ServicePricingTier {
  label: string;
  price: string;
  detail: string;
  amount?: number;
}

interface ServicePricingPlan {
  name: string;
  summary: string;
  tiers: ServicePricingTier[];
}

interface ServicePricingCategory {
  category: string;
  blurb: string;
  plans: ServicePricingPlan[];
}

interface TermSubSection {
  title: string;
  description?: string;
  bullets: string[];
}

interface AmcTerm {
  title: string;
  description?: string;
  bullets?: string[];
  sections?: TermSubSection[];
}

const servicePricing: ServicePricingCategory[] = [
  {
    category: 'Computer Services',
    blurb: 'From bespoke workstation builds to fast repair and upgrade programs.',
    plans: [
      {
        name: 'Repair Services',
        summary: 'Rapid fault isolation plus genuine spares for laptops and desktops.',
        tiers: [
          { label: 'Standard Repair', price: '₹999', detail: 'Includes diagnostics, OS tune-up, and labor (parts extra).', amount: 999 }
        ]
      },
      {
        name: 'Upgrade Services',
        summary: 'Extend hardware life with certified performance upgrades.',
        tiers: [
          { label: 'Upgrade Service Ticket', price: '₹999', detail: 'Covers labor for RAM, SSD, or GPU swaps (parts extra).', amount: 999 }
        ]
      }
    ]
  }
];

const companyInfo = {
  name: 'TECBUNNY SOLUTIONS PRIVATE LIMITED',
  cin: 'U80200GA2025PTC017488',
  udyam: 'UDYAM-GA-01-0047280',
  gstin: '30AAMCT1608G1ZO',
  ceo: 'SHUBHAM SAKHARAM BHISAJI',
  website: 'https://www.tecbunny.com'
};

const amcTerms: AmcTerm[] = [
  {
    title: 'Scope of Service & Inclusions',
    description: 'Limited comprehensive coverage for the specific CCTV and PC equipment documented in each contract annexure.',
    bullets: [
      'Preventive Maintenance visits for cleaning, diagnostics, and health checks.',
      'Unlimited breakdown support with labor and travel charges included.',
      'PC software assistance for OS corruption, malware removal, and third-party installation issues.',
      'Limited parts replacement benefit up to the value/claim caps defined in the selected plan.',
      'Applies only to the cameras, DVR/NVR, SMPS, and PCs listed in the annexure.'
    ]
  },
  {
    title: 'Prerequisites for Contract Initiation',
    bullets: [
      'All equipment must be documented and in fully working condition on the activation date.',
      'Non-working items must be repaired at standard rates before activation or remain excluded for the contract term.'
    ]
  },
  {
    title: 'Financial and Replacement Terms',
    bullets: [
      'Limited Parts Coverage (LPC) is capped by both a value limit and claim count per plan.',
      'After the limit is reached, labor stays free but replacement parts are billed to the customer.',
      'Hard disk replacements are excluded from LPC; only labor is covered for HDD swaps.'
    ]
  },
  {
    title: 'Exclusions (Not Covered)',
    bullets: [
      'Physical damage from misuse, tampering, fire, flood, lightning, or pest infestation.',
      'Electrical faults caused by voltage fluctuations, surges, or improper earthing.',
      'Any data loss for CCTV footage or PC data; backups remain the customer’s responsibility.',
      'Repairs performed by unauthorized personnel void coverage for the affected item.',
      'Consumables such as batteries, extensive cabling, or media beyond normal wear.',
      'External works including relocation, civil modifications, or specialized access equipment.'
    ]
  },
  {
    title: 'Service Level Agreement (SLA) & Termination',
    sections: [
      {
        title: 'Response Time',
        bullets: [
          'Home AMC calls receive on-site response within 48 business hours.',
          'Business and Enterprise AMC calls receive on-site response within 24 business hours.'
        ]
      },
      {
        title: 'Contract Duration & Termination',
        bullets: [
          'Contracts run for 12 non-transferable months.',
          'Either party may terminate with a 30-day written notice.',
          'No refunds are issued for the unexpired period.'
        ]
      },
      {
        title: 'Financial Settlement',
        bullets: [
          'If LPC benefits were used before termination, the parts value is deducted from any settlement.',
          'Final settlement, if applicable, is processed within 30 days of the official termination date.'
        ]
      }
    ]
  }
];

export interface ServicesPageProps {
  services: Service[];
  hasServiceLoadError?: boolean;
}

export default function ServicesPage({ services, hasServiceLoadError = false }: ServicesPageProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { trackEvent } = useAnalytics();
  const { atLeast } = usePermissions();
  const [busyServiceId, setBusyServiceId] = useState<string | null>(null);
  const canManageServices = atLeast('admin');
  useRevealSections();

  const getContactHref = (service: Service) => {
    const title = (service.title || '').toLowerCase();
    const category = (service.category || '').toLowerCase();

    if (title.includes('amc')) {
      return '/contact?subject=sales&service=amc_service&intent=amc_quote&message=I%20need%20an%20AMC%20quote.%20Please%20share%20coverage%20options%20for%20my%20setup.';
    }
    if (title.includes('cctv') && (title.includes('installation') || title.includes('new'))) {
      return '/contact?subject=sales&service=cctv_installation&intent=site_survey&message=I%20need%20a%20CCTV%20site%20survey%20and%20quote.%20Please%20contact%20me.';
    }
    if (title.includes('web')) {
      return '/contact?subject=web_development&service=web_development&intent=project_quote&message=I%20need%20a%20web%20development%20quote.%20Please%20contact%20me%20about%20my%20project.';
    }
    if (title.includes('repair')) {
      return '/contact?subject=support&service=repair_service&intent=service_request&message=I%20need%20help%20with%20a%20repair%20request.%20Please%20let%20me%20know%20the%20next%20steps.';
    }
    if (category.includes('computer')) {
      return '/contact?subject=sales&service=computer_setup&intent=project_quote&message=I%20need%20a%20computer%20setup%20or%20upgrade%20quote.%20Please%20contact%20me.';
    }
    return '/contact?subject=sales&service=general_service&intent=quote_request&message=I%20need%20a%20service%20quote.%20Please%20contact%20me%20with%20the%20next%20steps.';
  };

  const getServiceCtaLabel = (service: Service) => {
    const title = (service.title || '').toLowerCase();

    if (title.includes('amc')) return 'Request AMC Quote';
    if (title.includes('cctv') && (title.includes('installation') || title.includes('new'))) return 'Request CCTV Site Survey';
    if (title.includes('web')) return 'Request Web Project Quote';
    if (title.includes('repair')) return 'Request Repair Callback';
    if (title.includes('upgrade')) return 'Request Upgrade Quote';
    if (title.includes('custom')) return 'Request Build Quote';
    return 'Request Service Quote';
  };

  const serviceSections = services.reduce<Array<{ key: string; items: Service[] }>>((acc, service) => {
    const key = service.category || 'Services';
    const existing = acc.find(section => section.key === key);
    if (existing) {
      existing.items.push(service);
    } else {
      acc.push({ key, items: [service] });
    }
    return acc;
  }, []);

  const buildServiceProduct = (service: Service): Product => {
    const title = service.title || 'TecBunny Service';
    const parsedPrice = typeof service.price === 'number'
      ? service.price
      : Number(service.price ?? 0);
    const price = Number.isFinite(parsedPrice) ? parsedPrice : 0;
    const product: Product = {
      id: `service-${service.id}`,
      title,
      name: title,
      description: service.description || 'TecBunny expert service request.',
      price,
      mrp: price,
      offer_price: price,
      discount_percentage: 0,
      category: service.category || 'Services',
      image: '/brand.png',
      images: ['/brand.png'],
      product_type: 'service',
      tags: ['service', service.category || 'Services'],
      status: 'active',
      brand: 'TecBunny Services',
      popularity: 0,
      rating: 0,
      reviewCount: 0,
      created_at: service.created_at || new Date().toISOString(),
      updated_at: service.updated_at || undefined,
      gstRate: price > 0 ? 18 : 0,
      product_url: '/services',
      additional_images: [],
    };

    return product;
  };

  const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  const handleRaiseRequest = (service: Service) => {
    if (busyServiceId === service.id) return;
    setBusyServiceId(service.id);

    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const findDefaultAmount = (): number => {
      const normTitle = normalize(service.title || '');
      for (const category of servicePricing) {
        const categoryMatches = category.category.toLowerCase().includes(service.category?.toLowerCase() || '');
        for (const plan of category.plans) {
          const normPlan = normalize(plan.name);
          if (normTitle.includes(normPlan) || normPlan.includes(normTitle) || categoryMatches) {
            const tier = plan.tiers.find(t => typeof t.amount === 'number' && t.amount > 0);
            if (tier && typeof tier.amount === 'number') return tier.amount;
          }
        }
      }
      const firstTier = servicePricing
        .flatMap(c => c.plans.flatMap(p => p.tiers))
        .find(t => typeof t.amount === 'number' && t.amount > 0);
      return typeof firstTier?.amount === 'number' ? firstTier.amount : 0;
    };

    const fallbackAmount = findDefaultAmount();
    const coercedPrice = typeof service.price === 'number' && service.price > 0
      ? service.price
      : fallbackAmount;

    const product = buildServiceProduct({ ...service, price: coercedPrice });
    product.price = coercedPrice;
    product.offer_price = coercedPrice;
    product.gstRate = coercedPrice > 0 ? 18 : 0;
    product.gst_rate = product.gstRate;

    addToCart(product);
    router.push('/checkout?source=services');
  };

  const handlePricingTierAdd = (category: string, plan: ServicePricingPlan, tier: ServicePricingTier) => {
    if (!tier.amount) return;
    const syntheticId = `pricing-${slugify(category)}-${slugify(plan.name)}-${slugify(tier.label)}`;
    if (busyServiceId === syntheticId) return;
    setBusyServiceId(syntheticId);

    const nowIso = new Date().toISOString();
    const syntheticService: Service = {
      id: syntheticId,
      icon: category.includes('CCTV') ? 'Cctv' : 'Cpu',
      title: `${plan.name} – ${tier.label}`,
      description: `${plan.summary} ${tier.detail}`.trim(),
      features: [plan.summary, tier.detail],
      badge: null,
      is_active: true,
      price: tier.amount,
      duration_days: undefined,
      category: (category.includes('CCTV') ? 'CCTV' : 'Computer') as Service['category'],
      display_order: 0,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const product = buildServiceProduct(syntheticService);
    product.title = syntheticService.title;
    product.price = tier.amount;
    product.offer_price = tier.amount;
    product.gstRate = tier.amount > 0 ? 18 : 0;
    product.gst_rate = product.gstRate;

    addToCart(product);
    router.push('/checkout?source=services');
    setBusyServiceId(null);
  };

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
      <div className="pointer-events-none absolute left-1/2 top-32 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[140px]" />

      <HeroCarousel pageKey="services" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-20 pt-0 sm:px-6 lg:px-8 sm:pt-0">
        <section className="reveal-section text-center" data-reveal-id="services-hero">
          <div className={cn('reveal-item inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-violet-300', revealDelayClass(0))}>
            End-to-end Solutions
          </div>
          <h1 className={cn('reveal-item mt-6 text-4xl font-semibold text-white sm:text-5xl lg:text-6xl', revealDelayClass(70))}>
            Engineering{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              Sanctuary
            </span>
          </h1>
          <p className={cn('reveal-item mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg', revealDelayClass(140))}>
            From secure perimeters to smart automation, we deliver professional installation, maintenance, and service care across Goa.
          </p>
          {canManageServices && (
            <div className={cn('reveal-item mt-6 flex justify-center', revealDelayClass(210))}>
              <Link
                href="/mgmt/admin/services"
                className="inline-flex items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-cyan-200 transition-colors hover:border-cyan-400/60"
              >
                Manage Services
              </Link>
            </div>
          )}
        </section>

        <section className="reveal-section grid gap-4 md:grid-cols-2" data-reveal-id="services-quick-cta">
          <div className={cn('reveal-item flex flex-col gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-6 shadow-md', revealDelayClass(0))}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-300 flex items-center justify-center">
                <Cctv className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">CCTV New Setup</h3>
                <p className="text-sm text-slate-400">Site survey, design, and deployment with a tailored quote.</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="justify-center border-cyan-400/40 text-cyan-200 hover:border-cyan-400/70 hover:bg-cyan-500/10"
              onClick={() => {
                void trackEvent('services_cta_click', { cta: 'cctv_site_survey', destination: '/cctv-goa' });
                router.push('/cctv-goa');
              }}
            >
              Request CCTV Site Survey
            </Button>
          </div>
 
          <div className={cn('reveal-item flex flex-col gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-6 shadow-md', revealDelayClass(80))}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-300 flex items-center justify-center">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Computer and AMC Support</h3>
                <p className="text-sm text-slate-400">Capture requirements for workstation builds, support coverage, or ongoing maintenance.</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="justify-center border-blue-400/40 text-blue-200 hover:border-blue-400/70 hover:bg-blue-500/10"
              onClick={() => {
                void trackEvent('services_cta_click', { cta: 'amc_quote', destination: '/amc-goa' });
                router.push('/amc-goa');
              }}
            >
              Request AMC Quote
            </Button>
          </div>
 
          <div className={cn('reveal-item flex flex-col gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-6 shadow-md', revealDelayClass(160))}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Home Automation</h3>
                <p className="text-sm text-slate-400">Plan lighting, access, and smart-control workflows for the right kind of space.</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="justify-center border-emerald-400/40 text-emerald-200 hover:border-emerald-400/70 hover:bg-emerald-500/10"
              onClick={() => {
                void trackEvent('services_cta_click', { cta: 'automation_consultation', destination: '/smarthome-goa' });
                router.push('/smarthome-goa');
              }}
            >
              Book Automation Consultation
            </Button>
          </div>
 
          <div className={cn('reveal-item flex flex-col gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-6 shadow-md', revealDelayClass(240))}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-300 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">RFID and Access Control</h3>
                <p className="text-sm text-slate-400">Review guest, staff, and restricted-access workflows before installation.</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="justify-center border-violet-400/40 text-violet-200 hover:border-violet-400/70 hover:bg-violet-500/10"
              onClick={() => {
                void trackEvent('services_cta_click', { cta: 'rfid_demo', destination: '/rfid-goa' });
                router.push('/rfid-goa');
              }}
            >
              Request RFID Demo
            </Button>
          </div>
        </section>

        <section>
          <div className="space-y-8">
            {hasServiceLoadError && (
              <div className="reveal-section rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-left is-revealed" data-reveal-id="services-warning">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-200">Live Service Feed Unavailable</p>
                <p className="mt-2 text-sm text-amber-50/90">
                  We could not load the latest service catalog right now. You can still request a quote and our team will respond with the right service plan.
                </p>
                <Link
                  href="/contact?subject=sales&intent=service_quote&message=I%20need%20a%20service%20quote.%20Please%20contact%20me%20about%20the%20right%20next%20step."
                  className="mt-4 inline-flex items-center justify-center rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:border-amber-300/70"
                >
                  Request Service Quote
                </Link>
              </div>
            )}

            {!serviceSections.length && !hasServiceLoadError && (
              <div className="reveal-section rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center is-revealed" data-reveal-id="services-empty">
                <h2 className="text-xl font-semibold text-white">Service catalog updating</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
                  Our listed services are being refreshed. Use the quote request flow and we will recommend the right installation, support, or automation plan.
                </p>
                <Link
                  href="/contact?subject=sales&intent=service_quote&message=I%20need%20a%20service%20quote.%20Please%20contact%20me%20about%20the%20right%20next%20step."
                  className="mt-6 inline-flex items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-400/60"
                >
                  Request Service Quote
                </Link>
              </div>
            )}

            {serviceSections.map((section) => (
              <div key={section.key} className="reveal-section space-y-6" data-reveal-id={`services-group-${slugify(section.key)}`}>
                <div className={cn('reveal-item flex items-center gap-3', revealDelayClass(0))}>
                  <div className="h-8 w-1 rounded-full bg-cyan-400" />
                  <div>
                    <h2 className="text-2xl font-semibold text-white">{section.key}</h2>
                    <p className="text-sm text-slate-400">Explore curated services under {section.key.toLowerCase()}.</p>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((service, index) => {
                    const Icon = iconMap[service.icon] || Wrench;
                    return (
                      <div
                        key={service.id}
                        className={cn(
                          'reveal-item group flex h-full flex-col rounded-2xl border border-white/5 bg-slate-900/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/30',
                          revealDelayClass(80 + index * 80)
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 transition-transform duration-300 group-hover:scale-110">
                            <Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{service.title}</h3>
                            {service.badge && (
                              <p className="text-xs uppercase tracking-widest text-cyan-300">{service.badge}</p>
                            )}
                          </div>
                        </div>
                        <p className="mt-4 text-sm text-slate-400">{service.description}</p>
                        <ul className="mt-5 space-y-2 text-sm text-slate-500">
                          {service.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10"
                          onClick={() => {
                            const href = getContactHref(service);
                            void trackEvent('service_card_quote_click', {
                              serviceId: service.id,
                              serviceTitle: service.title,
                              destination: href,
                            });
                            router.push(href);
                          }}
                        >
                          <ShoppingCart className="h-4 w-4" />
                          {getServiceCtaLabel(service)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="reveal-section rounded-3xl border border-white/5 bg-black/20 p-6 sm:p-10" data-reveal-id="services-pricing">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className={cn('reveal-item', revealDelayClass(0))}>
              <h2 className="text-3xl font-semibold text-white">Service Rates & AMC Plans</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Transparent pricing tiers across CCTV and computer services. Final quotations include on-site assessment, travel, and consumables.
              </p>
            </div>
            <Link
              href="/contact?subject=sales&intent=service_quote&message=I%20need%20a%20service%20quote.%20Please%20contact%20me%20about%20the%20right%20next%20step."
              className={cn('reveal-item inline-flex items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-400/60', revealDelayClass(90))}
            >
              Request Service Quote
            </Link>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {servicePricing.map((category, categoryIndex) => (
              <div key={category.category} className={cn('reveal-item rounded-2xl border border-white/5 bg-slate-900/60 p-6', revealDelayClass(120 + categoryIndex * 90))}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-1 rounded-full bg-cyan-400" />
                  <div>
                    <h3 className="text-xl font-semibold text-white">{category.category}</h3>
                    <p className="text-sm text-slate-400">{category.blurb}</p>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {category.plans.map((plan, planIndex) => (
                    <div key={plan.name} className={cn('reveal-item rounded-xl border border-white/5 bg-black/30 p-4', revealDelayClass(160 + planIndex * 70))}>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-white">{plan.name}</p>
                        <p className="text-xs text-slate-500">{plan.summary}</p>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {plan.tiers.map((tier, tierIndex) => {
                          const tierId = `pricing-${slugify(category.category)}-${slugify(plan.name)}-${slugify(tier.label)}`;
                          const hasPrice = Boolean(tier.amount);
                          return (
                            <div
                              key={tier.label}
                              className={cn('reveal-item flex flex-col gap-2 rounded-lg border border-white/5 bg-slate-950/60 p-4', revealDelayClass(200 + tierIndex * 60))}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{tier.label}</p>
                                <p className="text-lg font-semibold text-cyan-200">{tier.price}</p>
                              </div>
                              <p className="text-xs text-slate-500">{tier.detail}</p>
                              <button
                                type="button"
                                className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10"
                                disabled={!hasPrice || busyServiceId === tierId}
                                onClick={() => handlePricingTierAdd(category.category, plan, tier)}
                              >
                                {hasPrice ? 'Add to Cart' : 'Request Quote'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            *All prices are indicative. Taxes, hardware, and travel charges (if applicable) are shared on the final quotation.
          </p>
        </section>

        <section className="reveal-section rounded-3xl border border-white/5 bg-slate-900/40 p-6 sm:p-10" data-reveal-id="services-amc">
          <div className={cn('reveal-item flex items-center gap-3', revealDelayClass(0))}>
            <div className="h-8 w-1 rounded-full bg-violet-400" />
            <div>
              <h2 className="text-2xl font-semibold text-white">Annual Maintenance Contract (AMC) Terms</h2>
              <p className="text-sm text-slate-400">General terms and conditions for CCTV and PC AMC plans.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 text-sm text-slate-300">
            <div className={cn('reveal-item', revealDelayClass(70))}>
              <p className="text-xs uppercase tracking-widest text-slate-500">Company</p>
              <p className="font-semibold text-white">{companyInfo.name}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(110))}>
              <p className="text-xs uppercase tracking-widest text-slate-500">CIN</p>
              <p>{companyInfo.cin}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(150))}>
              <p className="text-xs uppercase tracking-widest text-slate-500">Udyam</p>
              <p>{companyInfo.udyam}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(190))}>
              <p className="text-xs uppercase tracking-widest text-slate-500">GSTIN</p>
              <p>{companyInfo.gstin}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(230))}>
              <p className="text-xs uppercase tracking-widest text-slate-500">CEO</p>
              <p>{companyInfo.ceo}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(270))}>
              <p className="text-xs uppercase tracking-widest text-slate-500">Website</p>
              <a href={companyInfo.website} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200">
                {companyInfo.website.replace('https://', '')}
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            {amcTerms.map((term, index) => (
              <div key={term.title} className={cn('reveal-item rounded-2xl border border-white/5 bg-slate-950/60 p-5', revealDelayClass(120 + index * 70))}>
                <h3 className="text-lg font-semibold text-white">{term.title}</h3>
                {term.description && <p className="mt-1 text-sm text-slate-400">{term.description}</p>}
                {term.bullets && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-400">
                    {term.bullets.map((bullet, index) => (
                      <li key={index}>{bullet}</li>
                    ))}
                  </ul>
                )}
                {term.sections && (
                  <div className="mt-4 space-y-4">
                    {term.sections.map((section) => (
                      <div key={section.title}>
                        <p className="text-sm font-semibold text-white">{section.title}</p>
                        {section.description && <p className="text-sm text-slate-400">{section.description}</p>}
                        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-400">
                          {section.bullets.map((bullet, index) => (
                            <li key={index}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="reveal-section rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 p-8 text-center" data-reveal-id="services-closing-cta">
          <h2 className={cn('reveal-item text-2xl font-semibold text-white', revealDelayClass(0))}>Need Custom Solutions?</h2>
          <p className={cn('reveal-item mx-auto mt-3 max-w-md text-sm text-slate-400', revealDelayClass(70))}>
            Share your requirements and our team will craft a tailored setup for your space.
          </p>
          <Link
            href="/contact?subject=sales&intent=custom_solution&message=I%20need%20a%20custom%20solution%20quote.%20Please%20help%20me%20plan%20the%20right%20setup."
            className={cn('reveal-item mt-6 inline-flex items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-400/70', revealDelayClass(140))}
          >
            Request Custom Solution Quote
          </Link>
        </section>
      </div>
    </div>
  );
}