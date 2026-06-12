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

  const fallbackServicesList: Service[] = [
    {
      id: 'fallback-cctv',
      title: 'CCTV Camera Installation',
      description: 'Professional high-definition IP camera installations, secure local NVR/Cloud storage solutions, and remote mobile app viewing.',
      icon: 'Cctv',
      features: ['1080p/4K HDR video feed', 'Night vision & intelligent motion alerts', 'Secure local/cloud storage options', 'Remote access on iOS/Android'],
      badge: 'Popular',
      is_active: true,
      price: 9999,
      category: 'CCTV',
      display_order: 1,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
    {
      id: 'fallback-amc',
      title: 'Annual Maintenance Contract (AMC)',
      description: 'Keep your IT systems and security cameras operational 24/7 with our comprehensive support plans.',
      icon: 'Shield',
      features: ['Quarterly preventive health checks', 'Unlimited emergency breakdown calls', 'Free labor on parts replacement', 'Guaranteed response times'],
      badge: 'Recommended',
      is_active: true,
      price: 4999,
      category: 'Support',
      display_order: 2,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
    {
      id: 'fallback-smarthome',
      title: 'Smart Home Automation',
      description: 'Centralized and smartphone control for your lights, security, climate, and appliances with zero wire-cutting.',
      icon: 'Cpu',
      features: ['App and voice assistant controls', 'Automated energy saving workflows', 'Retrofit design for existing layouts', 'Multi-device integration'],
      badge: 'Featured',
      is_active: true,
      price: 14999,
      category: 'Installation',
      display_order: 3,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
    {
      id: 'fallback-rfid',
      title: 'RFID & Access Control Systems',
      description: 'Biometric and smartcard access solutions for modern offices, warehouses, hotel resorts, and retail sites.',
      icon: 'Award',
      features: ['Card and fingerprint authentication', 'Employee attendance integration', 'Electronic door lock integration', 'Visitor log tracking'],
      badge: 'New',
      is_active: true,
      price: 8999,
      category: 'Protection',
      display_order: 4,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
    {
      id: 'fallback-computer-repair',
      title: 'Computer Repair & Tune-up',
      description: 'Hardware diagnostics, RAM/SSD performance upgrades, OS clean installation, and malware/virus removal.',
      icon: 'Wrench',
      features: ['High-speed SSD upgrades', 'Professional OS configuration', 'Full internal dust cleaning', 'Certified parts replacement'],
      badge: null,
      is_active: true,
      price: 999,
      category: 'Computer',
      display_order: 5,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    }
  ];

  const activeServices = services && services.length > 0 ? services : fallbackServicesList;

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

  const serviceSections = activeServices.reduce<Array<{ key: string; items: Service[] }>>((acc, service) => {
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
    <div className="relative overflow-hidden bg-[#09090B] text-zinc-200">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
      <div className="pointer-events-none absolute left-1/2 top-32 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-blue-500/5 blur-[140px]" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-20 pt-16 sm:px-6 lg:px-8 sm:pt-24">
        <section className="reveal-section text-center" data-reveal-id="services-hero">
          <div className={cn('reveal-item inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-500', revealDelayClass(0))}>
            End-to-end Solutions
          </div>
          <h1 className={cn('reveal-item mt-6 text-4xl font-semibold text-white sm:text-5xl lg:text-6xl', revealDelayClass(70))}>
            Engineering{' '}
            <span className="bg-gradient-to-r from-white via-zinc-200 to-blue-500 bg-clip-text text-transparent">
              Sanctuary
            </span>
          </h1>
          <p className={cn('reveal-item mx-auto mt-4 max-w-2xl text-zinc-400 sm:text-lg', revealDelayClass(140))}>
            From secure perimeters to smart automation, we deliver professional installation, maintenance, and service care across Goa.
          </p>
          {canManageServices && (
            <div className={cn('reveal-item mt-6 flex justify-center', revealDelayClass(210))}>
              <Link
                href="/mgmt/admin/services"
                className="inline-flex items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-blue-400 transition-colors hover:border-blue-500/40 hover:bg-blue-600 hover:text-white"
              >
                Manage Services
              </Link>
            </div>
          )}
        </section>

        <section className="reveal-section grid gap-4 md:grid-cols-2" data-reveal-id="services-quick-cta">
          <div className={cn('reveal-item flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#09090B] p-6 shadow-md', revealDelayClass(0))}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Custom Solutions</h3>
                <p className="text-sm text-zinc-400">Tailored technology solutions designed for your specific needs.</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="justify-center border-blue-500/20 text-blue-400 hover:border-blue-500 hover:bg-blue-500/10"
              onClick={() => {
                void trackEvent('services_cta_click', { cta: 'custom_setup', destination: '/customised-setups' });
                router.push('/customised-setups');
              }}
            >
              Explore Custom Setups
            </Button>
          </div>
 
          <div className={cn('reveal-item flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#09090B] p-6 shadow-md', revealDelayClass(80))}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Professional Support</h3>
                <p className="text-sm text-zinc-400">Reliable technology services and ongoing technical support.</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="justify-center border-blue-500/20 text-blue-400 hover:border-blue-500 hover:bg-blue-500/10"
              onClick={() => {
                void trackEvent('services_cta_click', { cta: 'get_support', destination: '/contact' });
                router.push('/contact');
              }}
            >
              Get Support
            </Button>
          </div>
        </section>

        <section>
          <div className="space-y-8">
            {!serviceSections.length && !hasServiceLoadError && (
              <div className="reveal-section rounded-2xl border border-zinc-800 bg-[#09090B] p-8 text-center is-revealed" data-reveal-id="services-empty">
                <h2 className="text-xl font-semibold text-white">Service catalog updating</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-550">
                  Our listed services are being refreshed. Use the quote request flow and we will recommend the right installation, support, or automation plan.
                </p>
                <Link
                  href="/contact?subject=sales&intent=service_quote&message=I%20need%20a%20service%20quote.%20Please%20contact%20me%20about%20the%20right%20next%20step."
                  className="mt-6 inline-flex items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 transition-colors hover:bg-blue-600 hover:text-white"
                >
                  Request Service Quote
                </Link>
              </div>
            )}

            {serviceSections.map((section) => (
              <div key={section.key} className="reveal-section space-y-6" data-reveal-id={`services-group-${slugify(section.key)}`}>
                <div className={cn('reveal-item flex items-center gap-3', revealDelayClass(0))}>
                  <div className="h-8 w-1 rounded-full bg-blue-500" />
                  <div>
                    <h2 className="text-2xl font-semibold text-white">{section.key}</h2>
                    <p className="text-sm text-zinc-400">Explore curated services under {section.key.toLowerCase()}.</p>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((service, index) => {
                    const Icon = iconMap[service.icon] || Wrench;
                    return (
                      <div
                        key={service.id}
                        className={cn(
                          'reveal-item group flex h-full flex-col rounded-2xl border border-zinc-800 bg-[#09090B] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30',
                          revealDelayClass(80 + index * 80)
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 transition-transform duration-300 group-hover:scale-110">
                            <Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{service.title}</h3>
                            {service.badge && (
                              <p className="text-xs uppercase tracking-widest text-blue-500">{service.badge}</p>
                            )}
                          </div>
                        </div>
                        <p className="mt-4 text-sm text-zinc-400">{service.description}</p>
                        <ul className="mt-5 space-y-2 text-sm text-zinc-500">
                          {service.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-blue-500/30 hover:bg-blue-500/10"
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

        <section className="reveal-section rounded-3xl border border-zinc-800 bg-[#09090B]/60 p-6 sm:p-10" data-reveal-id="services-pricing">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className={cn('reveal-item', revealDelayClass(0))}>
              <h2 className="text-3xl font-semibold text-white">Service Rates & AMC Plans</h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Transparent pricing tiers across CCTV and computer services. Final quotations include on-site assessment, travel, and consumables.
              </p>
            </div>
            <Link
              href="/contact?subject=sales&intent=service_quote&message=I%20need%20a%20service%20quote.%20Please%20contact%20me%20about%20the%20right%20next%20step."
              className={cn('reveal-item inline-flex items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 transition-colors hover:border-blue-500/40 hover:bg-blue-600 hover:text-white', revealDelayClass(90))}
            >
              Request Service Quote
            </Link>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {servicePricing.map((category, categoryIndex) => (
              <div key={category.category} className={cn('reveal-item rounded-2xl border border-zinc-800 bg-[#09090B] p-6', revealDelayClass(120 + categoryIndex * 90))}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-1 rounded-full bg-blue-500" />
                  <div>
                    <h3 className="text-xl font-semibold text-white">{category.category}</h3>
                    <p className="text-sm text-zinc-400">{category.blurb}</p>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {category.plans.map((plan, planIndex) => (
                    <div key={plan.name} className={cn('reveal-item rounded-xl border border-zinc-800 bg-zinc-950/40 p-4', revealDelayClass(160 + planIndex * 70))}>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-white">{plan.name}</p>
                        <p className="text-xs text-zinc-550">{plan.summary}</p>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {plan.tiers.map((tier, tierIndex) => {
                          const tierId = `pricing-${slugify(category.category)}-${slugify(plan.name)}-${slugify(tier.label)}`;
                          const hasPrice = Boolean(tier.amount);
                          return (
                            <div
                              key={tier.label}
                               className={cn('reveal-item flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4', revealDelayClass(200 + tierIndex * 60))}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">{tier.label}</p>
                                <p className="text-lg font-semibold text-blue-400">{tier.price}</p>
                              </div>
                              <p className="text-xs text-zinc-550">{tier.detail}</p>
                              <button
                                type="button"
                                className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-blue-500/30 hover:bg-blue-500/10"
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

        <section className="reveal-section rounded-3xl border border-zinc-800 bg-[#09090B]/40 p-6 sm:p-10" data-reveal-id="services-amc">
          <div className={cn('reveal-item flex items-center gap-3', revealDelayClass(0))}>
            <div className="h-8 w-1 rounded-full bg-blue-500" />
            <div>
              <h2 className="text-2xl font-semibold text-white">Annual Maintenance Contract (AMC) Terms</h2>
              <p className="text-sm text-zinc-400">General terms and conditions for CCTV and PC AMC plans.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 text-sm text-zinc-350">
            <div className={cn('reveal-item', revealDelayClass(70))}>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Company</p>
              <p className="font-semibold text-white">{companyInfo.name}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(110))}>
              <p className="text-xs uppercase tracking-widest text-zinc-500">CIN</p>
              <p>{companyInfo.cin}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(150))}>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Udyam</p>
              <p>{companyInfo.udyam}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(190))}>
              <p className="text-xs uppercase tracking-widest text-zinc-500">GSTIN</p>
              <p>{companyInfo.gstin}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(230))}>
              <p className="text-xs uppercase tracking-widest text-zinc-500">CEO</p>
              <p>{companyInfo.ceo}</p>
            </div>
            <div className={cn('reveal-item', revealDelayClass(270))}>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Website</p>
              <a href={companyInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">
                {companyInfo.website.replace('https://', '')}
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            {amcTerms.map((term, index) => (
              <div key={term.title} className={cn('reveal-item rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5', revealDelayClass(120 + index * 70))}>
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

        <section className="reveal-section rounded-3xl border border-zinc-800 bg-[#09090B] p-8 text-center" data-reveal-id="services-closing-cta">
          <h2 className={cn('reveal-item text-2xl font-semibold text-white', revealDelayClass(0))}>Need Custom Solutions?</h2>
          <p className={cn('reveal-item mx-auto mt-3 max-w-md text-sm text-zinc-400', revealDelayClass(70))}>
            Share your requirements and our team will craft a tailored setup for your space.
          </p>
          <Link
            href="/contact?subject=sales&intent=custom_solution&message=I%20need%20a%20custom%20solution%20quote.%20Please%20help%20me%20plan%20the%20right%20setup."
            className={cn('reveal-item mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 text-sm font-semibold transition-colors', revealDelayClass(140))}
          >
            Request Custom Solution Quote
          </Link>
        </section>
      </div>
    </div>
  );
}
