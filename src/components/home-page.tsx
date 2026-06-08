'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Server,
  Wifi,
  Zap,
  CheckCircle2,
  Layers,
  Lock,
} from 'lucide-react';

import { getProductDisplayImage } from '@/lib/image-utils';
import { cn, revealDelayClass } from '@/lib/utils';
import { OptimizedImage } from './ui/optimized-image';
import type { Product } from '@/lib/types';
import { useNearViewport } from '../hooks/use-near-viewport';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';
import { BehavioralCouponPopup } from './BehavioralCouponPopup';

const AddToCartButton = dynamic(
  () => import('@/components/cart/AddToCartButton').then((module) => module.AddToCartButton),
  { ssr: false }
);

const HeroCarousel = dynamic(() => import('./HeroCarousel'), {
  ssr: false,
  loading: () => (
    <section className="py-10 sm:py-14" aria-hidden="true">
      <div className="container mx-auto px-4">
        <div className="h-[340px] sm:h-[420px] w-full animate-pulse rounded-3xl bg-slate-900/60 border border-white/5" />
      </div>
    </section>
  ),
});

type DbProduct = {
  id: string;
  title?: string;
  name?: string;
  price?: number;
  mrp?: number;
  image?: string | null;
  images?: Array<string | { url?: string | null }>;
  status?: string | null;
  description?: string | null;
  category?: string | null;
  popularity?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder' | null;
};

const FEATURE_PILLARS = [
  {
    title: 'Security Systems',
    desc: 'Layered protection with flexible monitoring and secure storage.',
    icon: ShieldCheck,
    accent: 'from-cyan-400/30 to-blue-500/30',
    href: '/services',
  },
  {
    title: 'IT Reliability',
    desc: 'Keep devices, networks, and workflows resilient and optimized.',
    icon: Server,
    accent: 'from-indigo-400/30 to-violet-500/30',
    href: '/services',
  },
  {
    title: 'Automation',
    desc: 'Smarter controls that adapt to the way you run your space.',
    icon: Wifi,
    accent: 'from-emerald-400/30 to-teal-500/30',
    href: '/innovation',
  },
  {
    title: 'Incident Response',
    desc: 'Rapid alerts, clear workflows, and actionable insights.',
    icon: Zap,
    accent: 'from-orange-400/30 to-rose-500/30',
    href: '/innovation',
  },
];

const PLAN_TIERS = [
  {
    name: 'Essentials',
    summary: 'Foundational coverage for smaller footprints.',
    priceLabel: 'From ₹4,999/month',
    highlight: false,
    items: ['Routine health checks', 'Remote assistance window', 'Lifecycle planning'],
  },
  {
    name: 'Growth',
    summary: 'Balanced coverage for multi-site needs.',
    priceLabel: 'From ₹14,999/month',
    highlight: true,
    items: ['Priority response lane', 'Quarterly optimization', 'Dedicated escalation path'],
  },
  {
    name: 'Enterprise',
    summary: 'High-availability operations at scale.',
    priceLabel: 'From ₹24,999/month',
    highlight: false,
    items: ['Always-on monitoring', 'On-site engineering', 'Strategic roadmap reviews'],
  },
];

const LOG_LINES = [
  { left: '> Active_Sites', right: '142 [ONLINE]', tone: 'text-emerald-300' },
  { left: '> Network_Uptime', right: '99.98% [NOMINAL]', tone: 'text-cyan-300' },
  { left: '> Monitored_Chs', right: '1,840 [SECURE]', tone: 'text-emerald-300' },
  { left: '> Dispatch_SLA', right: '< 2 Hrs [GUARANTEED]', tone: 'text-amber-300' },
];

function applyMagneticEffect(event: React.MouseEvent<HTMLElement>) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  
  // Use CSS variables to avoid direct DOM manipulation that conflicts with React's virtual DOM
  target.style.setProperty('--m-x', `${x * 0.15}px`);
  target.style.setProperty('--m-y', `${y * 0.15}px`);
  target.style.transform = 'translate(var(--m-x, 0px), var(--m-y, 0px))';
}

function resetMagneticEffect(event: React.MouseEvent<HTMLElement>) {
  const target = event.currentTarget;
  target.style.setProperty('--m-x', '0px');
  target.style.setProperty('--m-y', '0px');
  target.style.transform = 'translate(0px, 0px)';
}

function scheduleWhenIdle(callback: () => void, timeout = 1600) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => callback(), { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const timeoutId = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(timeoutId);
}

function useFinePointer() {
  const [hasFinePointer, setHasFinePointer] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updatePreference = () => setHasFinePointer(mediaQuery.matches);

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return hasFinePointer;
}

export default function HomePage() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasFinePointer = useFinePointer();
  const [featuredProducts, setFeaturedProducts] = React.useState<DbProduct[]>([]);
  const [partnerBrands, setPartnerBrands] = React.useState<Array<{ name: string; logoUrl: string }>>([
    { name: 'CP PLUS', logoUrl: '' },
    { name: 'HIKVISION', logoUrl: '' },
    { name: 'DAHUA', logoUrl: '' },
    { name: 'UBIQUITI', logoUrl: '' },
    { name: 'CISCO', logoUrl: '' },
    { name: 'TP-LINK', logoUrl: '' },
  ]);
  const [productsLoading, setProductsLoading] = React.useState(true);
  const [productsError, setProductsError] = React.useState<string | null>(null);
  const [enableAmbientEffects, setEnableAmbientEffects] = React.useState(false);
  const heroWords = ['Home.', 'Business.', 'Assets.', 'Future.'];
  const [heroWordIndex, setHeroWordIndex] = React.useState(0);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const tiltRef = React.useRef<HTMLDivElement | null>(null);
  const [carouselRef, shouldLoadCarousel] = useNearViewport<HTMLDivElement>('200px');
  const [hardwareRef, shouldLoadHardware] = useNearViewport<HTMLElement>('280px');

  React.useEffect(() => {
    if (prefersReducedMotion) {
      return undefined;
    }

    return scheduleWhenIdle(() => setEnableAmbientEffects(true), 4000);
  }, [prefersReducedMotion]);

  React.useEffect(() => {
    let isMounted = true;
    const fetchBrands = async () => {
      try {
        const res = await fetch('/api/settings?key=partnerBrands');
        if (res.ok) {
          const data = await res.json();
          const brandsStr = data?.value;
          if (brandsStr && typeof brandsStr === 'string' && isMounted) {
            const trimmed = brandsStr.trim();
            let list: Array<{ name: string; logoUrl: string }> = [];
            if (trimmed.startsWith('[')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                  list = parsed.map(item => ({
                    name: typeof item === 'object' && item?.name ? String(item.name) : '',
                    logoUrl: typeof item === 'object' && item?.logoUrl ? String(item.logoUrl) : '',
                  }));
                }
              } catch (e) {
                console.error('Failed to parse partnerBrands JSON on home:', e);
              }
            } else {
              list = trimmed
                .split(',')
                .map(b => ({ name: b.trim(), logoUrl: '' }))
                .filter(b => b.name.length > 0);
            }
            if (list.length > 0) {
              setPartnerBrands(list);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch partner brands:', err);
      }
    };
    fetchBrands();
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!shouldLoadHardware) {
      return undefined;
    }

    let isMounted = true;

    const runLoad = async () => {
      try {
        setProductsLoading(true);
        setProductsError(null);

        const response = await fetch('/api/products?status=active&limit=12');
        if (!response.ok) {
          throw new Error('Failed to load products');
        }

        const payload = await response.json();
        const items: DbProduct[] = Array.isArray(payload?.data) ? (payload.data as DbProduct[]) : [];
        const warningMessage = Array.isArray(payload?.warnings) && payload.warnings.length > 0
          ? String(payload.warnings[0])
          : null;

        const hasAnyImage = (item: DbProduct) => {
          if (getProductDisplayImage(item)) return true;
          if (typeof item.image === 'string' && item.image.trim().length > 0) return true;
          if (Array.isArray(item.images) && item.images.length) {
            const first = typeof item.images[0] === 'string' ? item.images[0] : (item.images[0] as any)?.url;
            return Boolean(first && String(first).trim().length > 0);
          }
          if (typeof (item as any).image_urls === 'string' && (item as any).image_urls.trim().length > 0) return true;
          return false;
        };

        const itemsWithImages = items.filter((item) => hasAnyImage(item));
        const chosen = (itemsWithImages.length ? itemsWithImages : items).slice(0, 4);

        if (isMounted) {
          if (chosen.length === 0 && warningMessage) {
            setProductsError(warningMessage);
          }
          setFeaturedProducts(chosen);
        }
      } catch (error) {
        if (isMounted) {
          setProductsError(error instanceof Error ? error.message : 'Failed to load products');
          setFeaturedProducts([]);
        }
      } finally {
        if (isMounted) {
          setProductsLoading(false);
        }
      }
    };

    const cancelIdleLoad = scheduleWhenIdle(() => {
      void runLoad();
    }, 1800);

    return () => {
      isMounted = false;
      cancelIdleLoad();
    };
  }, [shouldLoadHardware]);

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setHeroWordIndex(0);
      return undefined;
    }

    let intervalId: number;
    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        setHeroWordIndex((current) => (current + 1) % heroWords.length);
      }, 2400);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [heroWords.length, prefersReducedMotion]);

  React.useEffect(() => {
    if (prefersReducedMotion) {
      return undefined;
    }

    if (!enableAmbientEffects) {
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let animationId = 0;
    let width = 0;
    let height = 0;
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2 + 1,
    }));

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const draw = () => {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;

        context.fillStyle = 'rgba(56, 189, 248, 0.5)';
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      });
      animationId = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationId);
    };
  }, [enableAmbientEffects, prefersReducedMotion]);

  const handleTiltMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltRef.current || prefersReducedMotion || !hasFinePointer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateX = -((y - rect.height / 2) / 20);
    const rotateY = (x - rect.width / 2) / 20;
    tiltRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleTiltLeave = () => {
    if (!tiltRef.current) return;
    tiltRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  };

  const handleMagneticMove = (event: React.MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion || !hasFinePointer) return;
    applyMagneticEffect(event);
  };

  const handleMagneticLeave = (event: React.MouseEvent<HTMLElement>) => {
    resetMagneticEffect(event);
  };

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200 selection:bg-cyan-500/40 selection:text-white">
      <BehavioralCouponPopup />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-0 h-[42rem] w-[42rem] rounded-full bg-cyan-500/10 blur-[160px]" />
        <div className="absolute -right-40 top-1/3 h-[46rem] w-[46rem] rounded-full bg-violet-500/10 blur-[180px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.6),_rgba(2,6,23,0.9))]" />
      </div>

      <section className="relative flex items-center overflow-hidden py-20 sm:py-24">
        {enableAmbientEffects ? (
          <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full opacity-30 ${prefersReducedMotion ? 'hidden' : ''}`} aria-hidden="true" />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-20 brightness-100 contrast-150" />
        <div className="ambient-blob pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#06b6d4]/20 blur-[100px]" aria-hidden="true" />
        <div className="ambient-blob ambient-blob--delayed pointer-events-none absolute right-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-[#8b5cf6]/20 blur-[100px]" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 mx-auto">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div className="reveal-section space-y-8 is-revealed" data-reveal-id="hero-copy">
              <h1 className="text-4xl font-bold leading-[1.12] text-white sm:text-5xl md:text-6xl xl:text-7xl font-tech" aria-label="Technology Solutions and Services">
                <span className="glitch-text block pb-2" data-text="Technology">Technology</span>
                <span className="block bg-gradient-to-r from-[#06b6d4] via-blue-500 to-[#8b5cf6] bg-clip-text pt-1 text-transparent">
                  Solutions & Services
                </span>
              </h1>

              <div className="hero-rotator text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300" aria-hidden="true">
                {heroWords.map((word, index) => (
                  <span
                    key={word}
                    className={index === heroWordIndex ? 'hero-rotator__word hero-rotator__word--active' : 'hero-rotator__word'}
                  >
                    {word}
                  </span>
                ))}
              </div>

              <p className="max-w-lg text-lg leading-relaxed text-slate-400">
                TecBunny Solutions provides professional technology services and custom solutions tailored to your business needs.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/contact"
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  className="magnetic-btn relative inline-flex h-12 overflow-hidden rounded-lg p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]"></span>
                  <span className="inline-flex h-full w-full items-center justify-center rounded-lg bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl transition-colors hover:bg-slate-900">
                    Start Project
                  </span>
                </Link>
                <Link
                  href="/services"
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  className="magnetic-btn rounded-lg border border-white/10 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  View Services
                </Link>
              </div>

              <div className="flex gap-8 border-t border-white/5 pt-8">
                <div>
                  <p className="text-2xl font-bold text-white font-tech">120+</p>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Projects</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white font-tech">24/7</p>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Support</p>
                </div>
              </div>
            </div>

            <div className="reveal-section is-revealed relative hidden lg:block" data-reveal-id="hero-visual" id="hero-visual" onMouseMove={handleTiltMove} onMouseLeave={handleTiltLeave}>
              <div ref={tiltRef} className="hero-status-panel tilt-card relative z-10 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 shadow-2xl backdrop-blur-2xl">
                <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <div className="ml-auto text-xs font-mono text-slate-400">system_status.log</div>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  {LOG_LINES.map((log) => (
                    <div key={log.left} className={`flex justify-between ${log.tone}`}>
                      <span>{log.left}</span>
                      <span>{log.right}</span>
                    </div>
                  ))}
                </div>
                <div className="my-4 h-px bg-white/10"></div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-cyan-500/10 border border-cyan-400/20">
                    <ShieldCheck size={18} className="text-cyan-300" />
                  </div>
                  <div>
                    <p className="font-bold text-white">SLA Active</p>
                    <p className="text-xs text-slate-500">Response Guarantee Backed</p>
                  </div>
                </div>
              </div>
              <div className="absolute -inset-4 -z-10 rounded-2xl bg-[#06b6d4]/20 blur-xl"></div>
            </div>
          </div>
        </div>
      </section>

      <div ref={carouselRef}>
        {shouldLoadCarousel ? (
          <HeroCarousel pageKey="homepage" />
        ) : (
          <section className="py-6" aria-hidden="true">
            <div className="container mx-auto px-4">
              <div className="h-[340px] w-full rounded-3xl bg-slate-900/40 sm:h-[420px]" />
            </div>
          </section>
        )}
      </div>

      {/* Partner Brands Strip */}
      <section className="border-y border-white/5 bg-slate-950/80 py-10">
        <div className="container mx-auto px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 mb-6">
            Authorized Solutions & Brand Partnerships
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-16 opacity-65">
            {partnerBrands.map((brand, idx) => (
              <span key={idx} className="flex items-center justify-center transition-all hover:scale-105 duration-200">
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="h-8 md:h-10 w-auto object-contain max-w-[120px] filter brightness-75 contrast-125 hover:brightness-100 transition-all duration-200"
                  />
                ) : (
                  <span className="text-sm font-bold tracking-widest text-slate-400 font-tech hover:text-cyan-400 transition-colors">
                    {brand.name}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-24 reveal-section is-revealed" data-reveal-id="pillars">
        <div className="container mx-auto px-6">
          <div className="mb-14 max-w-2xl">
            <span className="text-xs uppercase tracking-[0.4em] text-cyan-300">Core pillars</span>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Designed for modern operations.</h2>
            <p className="mt-4 text-sm text-slate-400 sm:text-base">
              A flexible stack that adapts to new infrastructure, new spaces, and new business needs without the noise.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURE_PILLARS.map((pillar, index) => (
              <div
                key={pillar.title}
                className={cn(
                  'reveal-item spotlight-card spotlight-card--cyan rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-xl hover:shadow-cyan-500/10',
                  revealDelayClass(index * 90)
                )}
              >
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${pillar.accent}`}>
                  <pillar.icon size={22} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                <p className="mt-3 text-sm text-slate-400">{pillar.desc}</p>
                <Link
                  href={pillar.href}
                  className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300"
                >
                  Explore <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black/40 py-24 reveal-section is-revealed" data-reveal-id="plans">
        <div className="container mx-auto grid gap-12 px-6 lg:grid-cols-2 lg:items-center">
          <div className={cn('reveal-item relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-10', revealDelayClass(0))}>
            <div className="ambient-blob pointer-events-none absolute -left-6 top-10 h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-cyan-500/20 blur-2xl" aria-hidden="true"></div>
            <div className="ambient-blob ambient-blob--delayed pointer-events-none absolute -bottom-8 right-6 h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-violet-500/20 blur-2xl" aria-hidden="true"></div>
            <h3 className="text-2xl font-semibold text-white sm:text-3xl">Operational clarity, not complexity.</h3>
            <p className="mt-4 text-sm text-slate-400 sm:text-base">
              Build a secure foundation with a service model that keeps technology dependable and aligned with your goals.
            </p>
            <div className="mt-6 grid gap-4">
              {['Unified monitoring', 'Actionable reporting', 'Hands-on lifecycle support'].map((item, index) => (
                <div key={item} className={cn('reveal-item flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300', revealDelayClass(100 + index * 70))}>
                  <Layers size={16} className="text-cyan-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className={cn('space-y-6 reveal-item', revealDelayClass(80))}>
            <div>
              <span className="text-xs uppercase tracking-[0.4em] text-cyan-300">Plans</span>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Service tiers built to scale.</h2>
              <p className="mt-4 text-sm text-slate-400 sm:text-base">
                Choose the level of coverage that matches your footprint. Upgrade as your infrastructure grows.
              </p>
            </div>
            <div className="grid gap-4">
              {PLAN_TIERS.map((plan, index) => (
                <div
                  key={plan.name}
                  className={cn(
                    'reveal-item rounded-2xl border px-6 py-5 transition-transform duration-300 hover:-translate-y-1',
                    plan.highlight
                      ? 'border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                      : 'border-white/10 bg-white/5',
                    revealDelayClass(140 + index * 90)
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{plan.summary}</p>
                    </div>
                    <span className="text-xs font-semibold text-cyan-200">{plan.priceLabel}</span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-300">
                    {plan.items.map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-300" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section ref={hardwareRef} className="bg-slate-950 py-24 reveal-section is-revealed" data-reveal-id="hardware">
        <div className="container mx-auto px-6">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-[0.4em] text-cyan-300">Storefront</span>
              <h2 className="mt-3 text-3xl font-semibold text-white">Featured hardware</h2>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100"
            >
              Browse catalog <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {productsLoading &&
              [...Array(4)].map((_, idx) => (
                <div key={`skeleton-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 h-32 sm:h-40 rounded-xl bg-slate-800/60 animate-pulse"></div>
                  <div className="h-4 w-3/4 rounded bg-slate-800/60 animate-pulse"></div>
                </div>
              ))}

            {!productsLoading && featuredProducts.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
                {productsError || 'No products available yet.'}
              </div>
            )}

            {!productsLoading &&
              featuredProducts.map((product, index) => {
                const title = product.title || product.name || 'Product';
                const price = Number(product.price ?? product.mrp ?? 0);
                const oldPrice = Number(product.mrp ?? 0);
                const imageUrl =
                  getProductDisplayImage(product) ||
                  (Array.isArray(product.images)
                    ? (typeof product.images[0] === 'string'
                        ? product.images[0]
                        : (product.images[0] as any)?.url || '')
                    : '');
                const resolvedProduct: Product = {
                  ...product,
                  title,
                  name: title,
                  description: (product.description ?? '').trim(),
                  price,
                  category: product.category || 'General',
                  image: imageUrl || '',
                  popularity: product.popularity ?? 0,
                  rating: product.rating ?? 0,
                  reviewCount: product.reviewCount ?? 0,
                  created_at: product.created_at || new Date().toISOString(),
                } as Product;

                return (
                  <div key={product.id} className={cn('reveal-item rounded-2xl border border-white/10 bg-white/5 p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40', revealDelayClass(index * 90))}>
                    <div className="group/product relative mb-4 flex h-32 sm:h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-900">
                      {imageUrl ? (
                        <OptimizedImage
                          src={imageUrl}
                          alt={title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover/product:scale-105"
                          transformation={{ width: 480, height: 320, quality: 75 }}
                        />
                      ) : (
                        <Server size={52} className="text-slate-600" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className="text-cyan-200">₹{price.toLocaleString('en-IN')}</span>
                      {oldPrice > price && (
                        <span className="text-slate-400 line-through">₹{oldPrice.toLocaleString('en-IN')}</span>
                      )}
                    </div>
                    <AddToCartButton
                      product={resolvedProduct}
                      className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:border-cyan-400/40"
                      size="sm"
                    />
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      {/* Recent Installations Gallery */}
      <section className="bg-slate-950 py-24 border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="mb-14 max-w-2xl">
            <span className="text-xs uppercase tracking-[0.4em] text-cyan-300">Case Studies</span>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Recent Installations</h2>
            <p className="mt-4 text-sm text-slate-400 sm:text-base">
              Take a look at how we deploy security, IT networking, and home automation solutions across Goa and Maharashtra.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Grand Sunset Resort & Spa',
                location: 'Calangute, Goa',
                description: 'Designed and deployed a full 64-channel IP CCTV surveillance network and high-density guest Wi-Fi coverage across 3 resort wings.',
                tag: 'Resort IP CCTV'
              },
              {
                title: 'Mahad Industrial Zone Facility',
                location: 'Mahad, Maharashtra',
                description: 'Implemented multi-site server setups, structured optical fiber cabling, and biometric attendance/RFID door locks for 150+ staff.',
                tag: 'IT Infrastructure & Access Control'
              },
              {
                title: 'Premium Smart Villa',
                location: 'Panaji, Goa',
                description: 'Retrofitted an existing residential villa with wireless smart controls, automated perimeter alarms, smart locks, and motorized curtains.',
                tag: 'Home Automation'
              }
            ].map((project) => (
              <div key={project.title} className="rounded-2xl border border-white/5 bg-slate-900/40 p-6 flex flex-col justify-between hover:border-cyan-400/30 transition-all duration-300">
                <div>
                  <span className="inline-block rounded bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 mb-4">{project.tag}</span>
                  <h3 className="text-lg font-semibold text-white mb-2">{project.title}</h3>
                  <p className="text-xs text-slate-500 mb-4">{project.location}</p>
                  <p className="text-sm text-slate-400">{project.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>



      <section className="bg-slate-900/50 py-24 reveal-section is-revealed" data-reveal-id="about">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-slate-300 space-y-6 text-sm sm:text-base leading-relaxed">
            <h2 className="text-3xl font-semibold text-white mb-8">Goa & Maharashtra’s Trusted Technology Integrator</h2>
            <p>
              At TecBunny Solutions, we design, deploy, and manage professional technology systems that protect your premises, keep your networks reliable, and automate your environment. Working closely with leading security and network brands, we deliver customized security and IT solutions for hospitality venues, retail shops, industrial spaces, and residential properties across Goa and Maharashtra.
            </p>
            <p>
              Our security architectures are built with enterprise-grade equipment from CP Plus, Hikvision, and Dahua, offering high-definition IP cameras, smart perimeter security, and secure local or cloud NVR systems. We customize camera placement and coverage to ensure complete visual security and 24/7 reliability.
            </p>
            <p>
              For IT infrastructure, our engineers design high-performance wired and wireless networks, structured cabling layouts, and server setups to ensure zero-bottleneck operations. Backed by our proactive Annual Maintenance Contracts (AMC) and on-site support guarantees, we keep your business systems secure and running smoothly at all times.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-black/60 py-24 reveal-section is-revealed" data-reveal-id="cta">
        <div className="container mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-violet-500/10 p-10">
            <div className="ambient-blob pointer-events-none absolute -left-20 top-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" aria-hidden="true"></div>
            <div className="ambient-blob ambient-blob--delayed pointer-events-none absolute -bottom-20 right-0 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" aria-hidden="true"></div>
            <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className={cn('reveal-item', revealDelayClass(0))}>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                  <Sparkles size={14} /> Ready when you are
                </span>
                <h3 className="mt-5 text-2xl font-semibold text-white sm:text-3xl">Upgrade your space with confidence.</h3>
                <p className="mt-4 text-sm text-slate-300 sm:text-base">
                  Share your requirements and we will map a secure, scalable setup tailored to your environment.
                </p>
              </div>
              <div className={cn('reveal-item rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-center', revealDelayClass(120))}>
                <p className="text-sm text-slate-400">Talk to an advisor</p>
                <Link
                  href="/contact"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950"
                >
                  Request a consultation
                </Link>
                <p className="mt-3 text-xs text-slate-500">Response window: same business day</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
