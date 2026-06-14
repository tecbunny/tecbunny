'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Sliders,
  FileText,
  TrendingDown,
} from 'lucide-react';

import { getProductDisplayImage } from '@/lib/image-utils';
import { cn, revealDelayClass } from '@/lib/utils';
import { OptimizedImage } from './ui/optimized-image';
import type { Product } from '@/lib/types';
import { useNearViewport } from '../hooks/use-near-viewport';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';
import { BehavioralCouponPopup } from './BehavioralCouponPopup';
import { RegionalTrustBanner } from './RegionalTrustBanner';

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
    accent: 'from-zinc-900 to-zinc-950',
    href: '/services',
  },
  {
    title: 'IT Reliability',
    desc: 'Keep devices, networks, and workflows resilient and optimized.',
    icon: Server,
    accent: 'from-zinc-900 to-zinc-950',
    href: '/services',
  },
  {
    title: 'Automation',
    desc: 'Smarter controls that adapt to the way you run your space.',
    icon: Wifi,
    accent: 'from-zinc-900 to-zinc-950',
    href: '/services',
  },
  {
    title: 'Incident Response',
    desc: 'Rapid alerts, clear workflows, and actionable insights.',
    icon: Zap,
    accent: 'from-zinc-900 to-zinc-950',
    href: '/services',
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
  { left: '> Active_AMC_Sites', right: '47 [ONLINE]', tone: 'text-zinc-400' },
  { left: '> Avg_Response_Time', right: '9.2 Hours [NOMINAL]', tone: 'text-zinc-400' },
  { left: '> Hardware_Warranty', right: '1-3 Years [DIRECT]', tone: 'text-zinc-400' },
  { left: '> On_Site_Cover', right: 'Goa & MH [ACTIVE]', tone: 'text-zinc-400' },
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
  const router = useRouter();
  const [quoteNumberInput, setQuoteNumberInput] = React.useState('');
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [lookupError, setLookupError] = React.useState('');

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = quoteNumberInput.trim();
    if (!inputVal) return;
    
    setLookupLoading(true);
    setLookupError('');
    
    fetch(`/api/quotes/${inputVal}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Quote not found');
        }
        router.push(`/quotes/${inputVal}`);
      })
      .catch(() => {
        setLookupError('Invalid quote number or quote not found.');
        setLookupLoading(false);
      });
  };

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

        const response = await fetch('/api/products?status=active&limit=12', { cache: 'no-store' });
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

        context.fillStyle = 'rgba(59, 130, 246, 0.2)';
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
    <div className="relative overflow-hidden bg-[#09090B] text-zinc-200 selection:bg-blue-500/20 selection:text-white">
      <BehavioralCouponPopup />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-0 h-[42rem] w-[42rem] rounded-full bg-blue-500/5 blur-[160px]" />
        <div className="absolute -right-40 top-1/3 h-[46rem] w-[46rem] rounded-full bg-zinc-850/5 blur-[180px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(9,9,11,0.6),_rgba(9,9,11,0.95))]" />
      </div>

      <section className="relative flex items-center overflow-hidden py-28 sm:py-36 min-h-[90vh]">
        {enableAmbientEffects ? (
          <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full opacity-30 ${prefersReducedMotion ? 'hidden' : ''}`} aria-hidden="true" />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-20 brightness-100 contrast-150" />
        <div className="ambient-blob pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px] animate-pulse" aria-hidden="true" />
        <div className="ambient-blob ambient-blob--delayed pointer-events-none absolute right-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 mx-auto">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div className="reveal-section space-y-10 is-revealed animate-scale-in" data-reveal-id="hero-copy" style={{ animationDuration: '0.8s' }}>
              <h1 className="text-5xl font-extrabold leading-[1.05] text-white sm:text-6xl md:text-7xl xl:text-8xl font-tech tracking-tight" aria-label="Technology Solutions and Services">
                <span className="glitch-text block pb-3" data-text="Technology">Technology</span>
                <span className="block bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                  Solutions & Services
                </span>
              </h1>

              <div className="hero-rotator text-base font-black uppercase tracking-[0.4em] text-blue-500" aria-hidden="true">
                {heroWords.map((word, index) => (
                  <span
                    key={word}
                    className={index === heroWordIndex ? 'hero-rotator__word hero-rotator__word--active drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'hero-rotator__word'}
                  >
                    {word}
                  </span>
                ))}
              </div>

              <p className="max-w-xl text-xl leading-relaxed text-zinc-400 font-light">
                TecBunny Solutions provides professional technology services and custom solutions tailored to your business needs. We build the future.
              </p>

              <div className="flex flex-wrap gap-5">
                <Link
                  href="/contact"
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  className="magnetic-btn relative inline-flex h-14 overflow-hidden rounded-xl p-[1px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#09090B] hover:scale-105 transition-transform duration-300 shadow-[0_0_30px_-5px_rgba(59,130,246,0.4)]"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#3b82f6_0%,#09090b_50%,#3b82f6_100%)]"></span>
                  <span className="inline-flex h-full w-full items-center justify-center rounded-xl bg-[#09090B] px-8 py-3 text-base font-bold tracking-wide text-white backdrop-blur-3xl transition-colors hover:bg-zinc-900/90">
                    Start Project
                  </span>
                </Link>
                <Link
                  href="/services"
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  className="magnetic-btn rounded-xl border border-zinc-700 bg-zinc-900/30 px-8 py-3 text-base font-bold tracking-wide text-white transition-all hover:bg-white/10 hover:border-zinc-500 flex items-center justify-center backdrop-blur-sm"
                >
                  View Services
                </Link>
              </div>

              <div className="flex gap-10 border-t border-zinc-800/80 pt-10">
                <div className="group">
                  <p className="text-3xl font-black text-white font-tech group-hover:text-blue-400 transition-colors">100+</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-1">Installations</p>
                </div>
                <div className="group">
                  <p className="text-3xl font-black text-white font-tech group-hover:text-blue-400 transition-colors">SLA</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-1">Direct Support</p>
                </div>
              </div>
            </div>

            <div className="reveal-section is-revealed relative hidden lg:block animate-scale-in" data-reveal-id="hero-visual" id="hero-visual" onMouseMove={handleTiltMove} onMouseLeave={handleTiltLeave} style={{ animationDuration: '1s', animationDelay: '0.2s', animationFillMode: 'backwards' }}>
              <div ref={tiltRef} className="hero-status-panel tilt-card relative z-10 rounded-2xl border border-zinc-800 bg-[#0F172A]/80 p-8 shadow-[0_0_50px_-12px_rgba(59,130,246,0.25)] backdrop-blur-3xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <div className="mb-6 flex items-center gap-2 border-b border-zinc-800/80 pb-5 relative z-10">
                  <div className="h-3 w-3 rounded-full bg-rose-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-amber-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80"></div>
                  <div className="ml-auto text-xs font-mono font-bold tracking-widest text-blue-400 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    system_status.log
                  </div>
                </div>
                <div className="space-y-4 font-mono text-sm relative z-10">
                  {LOG_LINES.map((log, i) => (
                    <div key={log.left} className={`flex justify-between items-center ${log.tone} animate-fade-in`} style={{ animationDelay: `${0.5 + i * 0.1}s`, animationFillMode: 'backwards' }}>
                      <span className="font-semibold text-zinc-300">{log.left}</span>
                      <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-xs text-zinc-100">{log.right}</span>
                    </div>
                  ))}
                </div>
                <div className="my-6 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent relative z-10"></div>
                <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 relative z-10 transition-transform duration-300 group-hover:scale-[1.02]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    <ShieldCheck size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="font-black text-white text-base tracking-wide">SLA Active</p>
                    <p className="text-xs font-medium text-zinc-400 mt-0.5">Response Guarantee Backed</p>
                  </div>
                </div>
              </div>
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-blue-500/10 blur-2xl animate-pulse" style={{ animationDuration: '4s' }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Instant Quote & Negotiation System Promotion */}
      <section className="relative py-16 sm:py-20 bg-[#09090B]/40 border-y border-zinc-800 overflow-hidden">
        {/* Glow effects */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Promotion Info */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs font-semibold text-blue-500">
                <Sparkles size={14} className="animate-pulse" />
                Instant Quotation & Live Negotiation
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-tech leading-tight animate-reveal">
                Design Your CCTV Setup. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                  Negotiate Your Price Instantly.
                </span>
              </h2>
              <p className="text-base text-zinc-400 max-w-2xl leading-relaxed">
                Why wait for manual sales proposals? Use our custom setup configurator to design your security and IT ecosystem, preview exact retail vs. discount totals, and submit your own bid price directly.
              </p>
              
              {/* Feature grid */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Live Customization</h3>
                    <p className="text-xs text-zinc-500 mt-1">Adjust cameras, cabling, storage & accessories dynamically.</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
                    <TrendingDown size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Counter-Offer Engine</h3>
                    <p className="text-xs text-zinc-500 mt-1">Submit your bid target; we auto-negotiate and review within minutes.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Instant Formal PDF</h3>
                    <p className="text-xs text-zinc-500 mt-1">Download custom pricing summaries with 7-day validity details.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">System Compatibility</h3>
                    <p className="text-xs text-zinc-500 mt-1">Auto-verifies storage parameters & power needs in real time.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  href="/customised-setups"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-bold text-white transition shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20"
                >
                  Start Custom Setup Configurator
                  <ArrowRight size={16} className="ml-2" />
                </Link>
              </div>
            </div>

            {/* Right Column: Dynamic Quote Tracking Panel */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl border border-zinc-800 bg-[#09090B]/60 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
                <div className="absolute top-0 right-0 p-3 text-[10px] font-mono text-zinc-500">tecbunny_negotiation_v2.0</div>
                <h3 className="text-lg font-bold text-white font-tech tracking-wider uppercase mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  Track Active Negotiation
                </h3>
                <p className="text-xs text-zinc-400 mb-6">
                  Already submitted a counter-offer? Enter your YYYYMMXXXXX quote ID to track engineers' review status, download revised PDFs, or make your payment.
                </p>

                <form onSubmit={handleLookupSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="homepage-quote-id" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Quote / Negotiation ID
                    </label>
                    <input
                      id="homepage-quote-id"
                      type="text"
                      placeholder="e.g. 20260600001"
                      value={quoteNumberInput}
                      onChange={(e) => {
                        setQuoteNumberInput(e.target.value);
                        setLookupError('');
                      }}
                      className="w-full bg-[#09090B] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors"
                      disabled={lookupLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={lookupLoading || !quoteNumberInput.trim()}
                    className="w-full bg-blue-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-blue-500 disabled:opacity-50 transition duration-200 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {lookupLoading ? 'Validating ID...' : 'Check Status & Pay'}
                    <ArrowRight size={14} />
                  </button>
                </form>

                {lookupError && (
                  <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 text-center animate-fade-in">
                    {lookupError}
                  </div>
                )}

                <div className="mt-6 border-t border-zinc-800 pt-6 flex items-center justify-between text-xs text-zinc-500">
                  <span>Average engineering response time:</span>
                  <span className="text-blue-500 font-semibold">&lt; 15 mins</span>
                </div>
              </div>
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

      {/* 4. REAL-TIME REGIONAL SOCIAL PROOF */}
      <RegionalTrustBanner />

      {/* Partner Brands Strip */}
      <section className="border-y border-zinc-800 bg-[#09090B]/80 py-8 sm:py-10">
        <div className="container mx-auto px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 mb-6">
            Authorized Product Brands
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-16 opacity-65">
            {partnerBrands.map((brand) => (
              <span key={brand.name} className="flex items-center justify-center transition-all hover:scale-105 duration-200">
                {brand.logoUrl ? (
                  <OptimizedImage
                    src={brand.logoUrl}
                    alt={brand.name}
                    width={120}
                    height={40}
                    className="h-8 md:h-10 w-auto object-contain filter brightness-75 contrast-125 hover:brightness-100 transition-all duration-200"
                    transformation={{ quality: 80 }}
                  />
                ) : (
                  <span className="text-sm font-bold tracking-widest text-zinc-400 font-tech hover:text-blue-500 transition-colors">
                    {brand.name}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#09090B] py-12 sm:py-24 reveal-section is-revealed" data-reveal-id="pillars">
        <div className="container mx-auto px-6">
          <div className="mb-14 max-w-2xl">
            <span className="text-xs uppercase tracking-[0.4em] text-blue-500">Core pillars</span>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Designed for modern operations.</h2>
            <p className="mt-4 text-sm text-zinc-400 sm:text-base">
              A flexible stack that adapts to new infrastructure, new spaces, and new business needs without the noise.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURE_PILLARS.map((pillar, index) => (
              <div
                key={pillar.title}
                className={cn(
                  'reveal-item rounded-2xl border border-zinc-800 bg-[#09090B] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700/40 hover:shadow-xl hover:shadow-zinc-800/10',
                  revealDelayClass(index * 90)
                )}
              >
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${pillar.accent}`}>
                  <pillar.icon size={22} className="text-zinc-200" />
                </div>
                <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                <p className="mt-3 text-sm text-zinc-400">{pillar.desc}</p>
                <Link
                  href={pillar.href}
                  className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-500 hover:text-blue-400 transition-colors"
                >
                  Explore <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#09090B]/40 py-12 sm:py-24 reveal-section is-revealed" data-reveal-id="plans">
        <div className="container mx-auto grid gap-12 px-6 lg:grid-cols-2 lg:items-center">
          <div className={cn('reveal-item relative rounded-3xl border border-zinc-800 bg-[#09090B] p-5 sm:p-10', revealDelayClass(0))}>
            <div className="ambient-blob pointer-events-none absolute -left-6 top-10 h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-blue-500/5 blur-2xl" aria-hidden="true"></div>
            <div className="ambient-blob ambient-blob--delayed pointer-events-none absolute -bottom-8 right-6 h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-zinc-800/10 blur-2xl" aria-hidden="true"></div>
            <h3 className="text-2xl font-semibold text-white sm:text-3xl">Operational clarity, not complexity.</h3>
            <p className="mt-4 text-sm text-zinc-400 sm:text-base">
              Build a secure foundation with a service model that keeps technology dependable and aligned with your goals.
            </p>
            <div className="mt-6 grid gap-4">
              {['Unified monitoring', 'Actionable reporting', 'Hands-on lifecycle support'].map((item, index) => (
                <div key={item} className={cn('reveal-item flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300', revealDelayClass(100 + index * 70))}>
                  <Layers size={16} className="text-blue-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className={cn('space-y-6 reveal-item', revealDelayClass(80))}>
            <div>
              <span className="text-xs uppercase tracking-[0.4em] text-blue-500">Plans</span>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Service tiers built to scale.</h2>
              <p className="mt-4 text-sm text-zinc-400 sm:text-base">
                Choose the level of coverage that matches your footprint. Upgrade as your infrastructure grows.
              </p>
            </div>
            <div className="grid gap-4">
              {PLAN_TIERS.map((plan, index) => (
                <div
                  key={plan.name}
                  className={cn(
                    'reveal-item rounded-2xl border px-6 py-5 transition-transform duration-300 hover:-translate-y-1 flex flex-col justify-between',
                    plan.highlight
                      ? 'border-blue-500/30 bg-blue-500/5 shadow-sm'
                      : 'border-zinc-800 bg-[#09090B]',
                    revealDelayClass(140 + index * 90)
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">{plan.summary}</p>
                      </div>
                      <span className="text-xs font-semibold text-blue-400">{plan.priceLabel}</span>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-zinc-300">
                      {plan.items.map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-zinc-400" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-zinc-800">
                    <Link
                      href={`/contact?subject=sales&service=amc_service&intent=amc_quote&message=I%20am%20interested%20in%20the%20${plan.name}%20plan.%20Please%20contact%20me.`}
                      className={cn(
                        "inline-flex w-full items-center justify-center rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                        plan.highlight
                          ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-500"
                          : "border-zinc-800 bg-zinc-900/50 text-white hover:bg-zinc-800"
                      )}
                    >
                      Get Started
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section ref={hardwareRef} className="bg-[#09090B] py-12 sm:py-24 reveal-section is-revealed" data-reveal-id="hardware">
        <div className="container mx-auto px-6">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-[0.4em] text-blue-500">Storefront</span>
              <h2 className="mt-3 text-3xl font-semibold text-white">Featured hardware</h2>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300"
            >
              Browse catalog <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {productsLoading &&
              [...Array(4)].map((_, idx) => (
                <div key={`skeleton-${idx}`} className="rounded-2xl border border-zinc-800 bg-[#09090B] p-5 animate-pulse">
                  <div className="mb-4 h-32 sm:h-40 rounded-xl bg-zinc-900"></div>
                  <div className="h-4 w-3/4 rounded bg-zinc-900"></div>
                </div>
              ))}

            {!productsLoading && featuredProducts.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-zinc-800 bg-[#09090B] p-8 text-center text-zinc-500">
                {productsError || 'No products available yet.'}
              </div>
            )}

            {!productsLoading &&
              featuredProducts.map((product, index) => {
                const title = product.title || product.name || 'Product';
                const gstRate = Number((product as any).gstRate ?? (product as any).gst_rate ?? 18);
                const rawPrice = Number(product.price ?? product.mrp ?? 0);
                const rawMrp = Number(product.mrp ?? rawPrice);
                
                const price = Math.round(rawPrice * (1 + gstRate / 100));
                const oldPrice = Math.round(rawMrp * (1 + gstRate / 100));
                const imageUrl = getProductDisplayImage(product) || '';
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
                  <div key={product.id} className={cn('reveal-item rounded-2xl border border-zinc-800 bg-[#09090B] p-5 transition duration-300 hover:-translate-y-1 hover:border-zinc-700/40 flex flex-col justify-between', revealDelayClass(index * 90))}>
                    <Link href={`/products/${product.id}`} className="group/product-link block">
                      <div className="group/product relative mb-4 flex h-32 sm:h-40 items-center justify-center overflow-hidden rounded-xl bg-zinc-900 p-2 border border-zinc-800">
                        {imageUrl ? (
                          <OptimizedImage
                            src={imageUrl}
                            alt={title}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="h-full w-full object-contain transition-transform duration-500 group-hover/product:scale-105"
                            transformation={{ width: 480, height: 320, quality: 75 }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-2 border border-zinc-850 rounded-xl text-zinc-500 hover:text-blue-500 hover:border-blue-500/20 transition-all duration-300">
                            <Server size={36} className="text-zinc-600 group-hover/product-link:text-blue-500 transition-colors" />
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 font-tech">Hardware</span>
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white group-hover/product-link:text-blue-500 transition-colors line-clamp-2 min-h-[40px]">{title}</h3>
                    </Link>
                    <div>
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <span className="text-blue-400 font-semibold">₹{price.toLocaleString('en-IN')}</span>
                        {oldPrice > price && (
                          <span className="text-zinc-500 line-through">₹{oldPrice.toLocaleString('en-IN')}</span>
                        )}
                      </div>
                      <AddToCartButton
                        product={resolvedProduct}
                        className="mt-4 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs font-semibold text-white hover:border-blue-500/30 transition-colors"
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </section>




      <section className="bg-[#09090B]/50 border-t border-zinc-800 py-12 sm:py-24 reveal-section is-revealed" data-reveal-id="about">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-zinc-400 space-y-6 text-sm sm:text-base leading-relaxed">
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

      <section className="bg-[#09090B] border-t border-zinc-800 py-12 sm:py-24 reveal-section is-revealed" data-reveal-id="cta">
        <div className="container mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-[#09090B] p-6 sm:p-8 md:p-10">
            <div className="ambient-blob pointer-events-none absolute -left-20 top-10 h-40 w-40 rounded-full bg-blue-500/5 blur-3xl" aria-hidden="true"></div>
            <div className="ambient-blob ambient-blob--delayed pointer-events-none absolute -bottom-20 right-0 h-40 w-40 rounded-full bg-zinc-800/10 blur-3xl" aria-hidden="true"></div>
            <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className={cn('reveal-item', revealDelayClass(0))}>
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
                  <Sparkles size={14} /> Ready when you are
                </span>
                <h3 className="mt-5 text-2xl font-semibold text-white sm:text-3xl">Upgrade your space with confidence.</h3>
                <p className="mt-4 text-sm text-zinc-400 sm:text-base">
                  Share your requirements and we will map a secure, scalable setup tailored to your environment.
                </p>
              </div>
              <div className={cn('reveal-item rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-center', revealDelayClass(120))}>
                <p className="text-sm text-zinc-500">Talk to an advisor</p>
                <Link
                  href="/contact"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition-colors"
                >
                  Request a consultation
                </Link>
                <p className="mt-3 text-xs text-zinc-500">Response window: same business day</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
