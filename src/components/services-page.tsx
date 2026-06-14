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
  Sparkles
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn, revealDelayClass } from '@/lib/utils';
import { useCart } from '@/lib/hooks';
import { useAnalytics } from '../hooks/use-analytics';
import { usePermissions } from '../hooks/use-permissions';
import { useRevealSections } from '../hooks/use-reveal-sections';
import type { Product, Service } from '@/lib/types';
import { BRAND_LOGO_URL } from '@/components/ui/logo';

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
    category: 'CCTV & AMC Services',
    blurb: 'Professional installation and ongoing maintenance plans for cameras, NVRs, and access systems.',
    plans: [
      {
        name: 'Home AMC',
        summary: 'For homes with 4–8 cameras and one PC.',
        tiers: [
          { label: 'Home AMC — Annual', price: 'from ₹3,499/yr', detail: '2 preventive visits · Unlimited breakdown calls (labour & travel) · On-site within 48 hrs · Parts up to ₹2,000/yr', amount: 3499 }
        ]
      },
      {
        name: 'Business AMC',
        summary: 'For shops, restaurants and offices up to 16 cameras.',
        tiers: [
          { label: 'Business AMC — Annual', price: 'from ₹8,999/yr', detail: '4 preventive visits + quarterly report · On-site within 24 hrs · Priority lane · Parts up to ₹6,000/yr', amount: 8999 }
        ]
      },
      {
        name: 'Enterprise AMC',
        summary: 'For hotels, multi-site operations and large offices.',
        tiers: [
          { label: 'Enterprise AMC — Annual', price: 'from ₹29,999/yr', detail: 'Always-on monitoring · Named on-site engineer · Quarterly strategic reviews · Custom SLA & parts pool', amount: 29999 }
        ]
      },
      {
        name: 'CCTV New Installation',
        summary: 'Supply, cable, configure and commission CP PLUS / Hikvision camera systems.',
        tiers: [
          { label: '4-Camera Kit (Home)', price: 'from ₹14,999', detail: '4 cameras · 4-ch NVR · 1TB HDD · Full cabling · Mobile app setup', amount: 14999 },
          { label: '8-Camera Kit (Shop/Office)', price: 'from ₹24,999', detail: '8 cameras · 8-ch NVR · 2TB HDD · Full cabling · Remote access', amount: 24999 },
        ]
      }
    ]
  },
  {
    category: 'Computer Services',
    blurb: 'From bespoke workstation builds to fast repair and upgrade programs.',
    plans: [
      {
        name: 'Repair Services',
        summary: 'Rapid fault isolation plus genuine spares for laptops and desktops.',
        tiers: [
          { label: 'Standard Repair', price: '₹999', detail: 'Includes diagnostics, OS tune-up, and labour (parts extra).', amount: 999 }
        ]
      },
      {
        name: 'Upgrade Services',
        summary: 'Extend hardware life with certified performance upgrades.',
        tiers: [
          { label: 'Upgrade Service Ticket', price: '₹999', detail: 'Covers labour for RAM, SSD, or GPU swaps (parts extra).', amount: 999 }
        ]
      }
    ]
  },
  {
    category: 'Smart Home & Access Control',
    blurb: 'Retrofit automation and access control for homes, hotels and offices.',
    plans: [
      {
        name: 'Home Automation Starter',
        summary: 'Voice + app control for lighting, fans and door bells.',
        tiers: [
          { label: 'Starter Pack (up to 5 nodes)', price: 'from ₹12,999', detail: 'Includes devices, programming, app setup, and 1-year support call.', amount: 12999 }
        ]
      },
      {
        name: 'RFID Access Control',
        summary: 'Biometric and smartcard access for offices, warehouses and hotels.',
        tiers: [
          { label: 'Single Door RFID Kit', price: 'from ₹8,999', detail: 'Controller · reader · electric lock · power supply · programming & commissioning.', amount: 8999 }
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
      return '/contact?subject=support&service=repair_service&intent=service_request&message=I%20need%20help%20with%20a%20repair%20request.%20Please%20let%2520me%20know%20the%2520next%20steps.';
    }
    if (category.includes('computer')) {
      return '/contact?subject=sales&service=computer_setup&intent=project_quote&message=I%20need%20a%20computer%20setup%20or%20upgrade%20quote.%20Please%20contact%20me.';
    }
    return '/contact?subject=sales&service=general_service&intent=quote_request&message=I%20need%20a%20service%20quote.%20Please%20contact%20me%20with%20the%20next%20steps.';
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
    const title = service.title || service.name || 'TecBunny Service';
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
      image: BRAND_LOGO_URL,
      images: [BRAND_LOGO_URL],
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

  const handleAddToCart = (service: Service) => {
    if (busyServiceId === service.id) return;
    setBusyServiceId(service.id);

    const coercedPrice = typeof service.price === 'number' && service.price > 0 ? service.price : 0;
    const product = buildServiceProduct(service);
    product.price = coercedPrice;
    product.offer_price = coercedPrice;
    product.gstRate = coercedPrice > 0 ? 18 : 0;
    product.gst_rate = product.gstRate;

    addToCart(product);
    setBusyServiceId(null);
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
    setBusyServiceId(null);
  };

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
        
        {/* Page Hero */}
        <section className="reveal-section text-center space-y-6 max-w-3xl mx-auto" data-reveal-id="services-hero">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4.5 py-1.5 text-xs font-semibold text-blue-400">
            <Sparkles size={14} className="animate-pulse" />
            <span>Platform Services</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl font-tech leading-tight tech-heading">
            Expert Tech <span className="bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent">Deployment</span>
          </h1>
          <p className="text-lg font-light leading-relaxed tech-body">
            From smart security perimeters to comprehensive AMC support, customize your service package dynamically or purchase transparent installation credits directly.
          </p>
          {canManageServices && (
            <div className="mt-6 flex justify-center">
              <Link
                href="/superadmin/mgmt/services"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 text-blue-400 hover:bg-zinc-800/80 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors shadow-sm"
              >
                Services Core Desk
              </Link>
            </div>
          )}
        </section>

        {/* Premium Enterprise Solutions Banners */}
        <section className="reveal-section grid gap-8 lg:grid-cols-2" data-reveal-id="premium-enterprise-services">
          {/* Card 1: Smart Infrastructure */}
          <div className="bento-card p-8 flex flex-col justify-between group transition-all duration-300">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2.5 py-0.5">
                Hospitality & Construction
              </span>
              <h3 className="text-xl font-bold font-tech tech-heading">Next-Gen Smart Infrastructure</h3>
              <p className="text-xs leading-relaxed max-w-sm tech-body">
                Enterprise technology integration for luxury resorts, hotels, and modern builders. CCTV projects, RFID locks, and complete automation.
              </p>
            </div>
            <div className="mt-8">
              <Link
                href="/services/smart-infrastructure"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-550 text-white px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-blue-500/10"
              >
                Explore Enterprise Projects
              </Link>
            </div>
          </div>

          {/* Card 2: Web Dev */}
          <div className="bento-card p-8 flex flex-col justify-between group transition-all duration-300">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2.5 py-0.5">
                Web Development
              </span>
              <h3 className="text-xl font-bold font-tech tech-heading">Bespoke Web Solutions</h3>
              <p className="text-xs leading-relaxed max-w-sm tech-body">
                Custom e-commerce platforms, custom admin panels, landing pages, and WhatsApp integration systems.
              </p>
            </div>
            <div className="mt-8">
              <Link
                href="/webdev"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-550 text-white px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-indigo-500/10"
              >
                View Web Services
              </Link>
            </div>
          </div>
        </section>

        {/* Dynamic Services Catalog */}
        <section className="space-y-16">
          {(!services || services.length === 0) && !hasServiceLoadError && (
            <div className="bento-card p-12 text-center shadow-sm">
              <Wrench className="h-10 w-10 text-zinc-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold font-tech tech-heading">Services catalog updating</h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-light tech-body">
                Our database listings are undergoing synchronization. Please connect with our support desk for direct reservations.
              </p>
              <Link
                href="/contact?subject=sales&intent=service_quote"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                Connect Support
              </Link>
            </div>
          )}

          {serviceSections.map((section) => (
            <div key={section.key} className="reveal-section space-y-6" data-reveal-id={`services-group-${slugify(section.key)}`}>
              <div className="flex items-center gap-3">
                <div className="h-6 w-1 rounded-full bg-blue-500" />
                <div>
                  <h2 className="text-xl font-bold font-tech tech-heading">{section.key}</h2>
                  <p className="text-xs text-zinc-500">Professional services configured under {section.key.toLowerCase()}.</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {section.items.map((service) => {
                  const Icon = iconMap[service.icon] || Wrench;
                  return (
                    <div
                      key={service.id}
                      className="bento-card p-6 flex flex-col justify-between h-full transition-all duration-300"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Icon className="h-5.5 w-5.5" />
                          </div>
                          {service.badge && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2.5 py-0.5">
                              {service.badge}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-4 text-base font-bold font-tech tech-heading">{service.title || service.name}</h3>
                        <p className="mt-2 text-xs line-clamp-3 leading-relaxed font-light tech-body">{service.description}</p>
                        
                        {service.features && service.features.length > 0 && (
                          <ul className="mt-4 space-y-2 text-xs text-zinc-500">
                            {service.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-50" />
                                <span className="line-clamp-2 font-light tech-body">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-col gap-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Rate Credit</span>
                          <span className="text-base font-bold font-mono tech-heading">
                            {service.price ? `₹${Number(service.price).toLocaleString('en-IN')}` : 'Quotation Basis'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddToCart(service)}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-555 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)] disabled:opacity-50"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Add Service to Cart
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const href = getContactHref(service);
                            router.push(href);
                          }}
                          className="w-full py-2 border border-zinc-800 text-zinc-450 hover:bg-zinc-800/30 text-xs font-semibold rounded-lg transition-colors text-center"
                        >
                          Consult Engineering Team
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Static Rates Matrix Section */}
        <section className="reveal-section rounded-2xl border border-zinc-850 p-6 sm:p-8 shadow-sm bento-card" data-reveal-id="services-pricing">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold font-tech tech-heading">Direct Purchase Rates & Plans</h2>
              <p className="text-xs mt-1 font-light tech-body">
                Indicator credit rates for structured automation and maintenance services across Goa.
              </p>
            </div>
            <Link
              href="/contact?subject=sales&intent=service_quote"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/30 hover:bg-white/10 hover:border-zinc-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
              Request Custom Quote
            </Link>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {servicePricing.map((category) => (
              <div key={category.category} className="rounded-xl border border-zinc-850 bg-zinc-950/20 p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-sm font-tech tech-heading">{category.category}</h3>
                  <p className="text-xs mt-0.5 font-light tech-body">{category.blurb}</p>
                </div>
                <div className="space-y-4">
                  {category.plans.map((plan) => (
                    <div key={plan.name} className="bento-card p-4 space-y-3 shadow-xs">
                      <div>
                        <p className="text-xs font-bold tech-heading">{plan.name}</p>
                        <p className="text-[10px] font-light tech-body">{plan.summary}</p>
                      </div>
                      <div className="grid gap-2">
                        {plan.tiers.map((tier) => {
                          const hasPrice = Boolean(tier.amount);
                          return (
                            <div key={tier.label} className="border border-zinc-900 bg-zinc-900/20 rounded-md p-3 flex flex-col gap-2">
                              <div className="flex justify-between items-baseline">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">{tier.label}</span>
                                <span className="text-xs font-bold font-mono tech-heading">{tier.price}</span>
                              </div>
                              <p className="text-[10px] leading-normal font-light tech-body">{tier.detail}</p>
                              {hasPrice && (
                                <button
                                  type="button"
                                  onClick={() => handlePricingTierAdd(category.category, plan, tier)}
                                  className="w-full mt-1 py-1.5 bg-zinc-900 hover:bg-blue-600 hover:text-white text-zinc-300 border border-zinc-800 text-[10px] font-bold uppercase tracking-wider rounded transition-colors text-center"
                                >
                                  Add to Cart
                                </button>
                              )}
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
        </section>


      </div>
    </div>
  );
}
