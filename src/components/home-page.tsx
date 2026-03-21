'use client';

import React from 'react';
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
} from 'lucide-react';

import { AddToCartButton } from '../components/cart/AddToCartButton';
import { getProductDisplayImage } from '../lib/image-utils';
import { OptimizedImage } from './ui/optimized-image';
import type { Product } from '../lib/types';
import { useAnalytics } from '../hooks/use-analytics';
import HeroCarousel from './HeroCarousel';

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
    priceLabel: 'Custom quote',
    highlight: false,
    items: ['Routine health checks', 'Remote assistance window', 'Lifecycle planning'],
  },
  {
    name: 'Growth',
    summary: 'Balanced coverage for multi-site needs.',
    priceLabel: 'Scaled by scope',
    highlight: true,
    items: ['Priority response lane', 'Quarterly optimization', 'Dedicated escalation path'],
  },
  {
    name: 'Enterprise',
    summary: 'High-availability operations at scale.',
    priceLabel: 'Custom engagement',
    highlight: false,
    items: ['Always-on monitoring', 'On-site engineering', 'Strategic roadmap reviews'],
  },
];

const LOG_LINES = [
  { left: '> Camera_01', right: 'ONLINE [REC]', tone: 'text-emerald-300' },
  { left: '> Intrusion_Sys', right: 'ARMED', tone: 'text-emerald-300' },
  { left: '> Server_Rack', right: 'TEMP_OK', tone: 'text-cyan-300' },
];

function applyMagneticEffect(event: React.MouseEvent<HTMLElement>) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  target.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
}

function resetMagneticEffect(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.style.transform = 'translate(0px, 0px)';
}

export default function HomePage() {
  const router = useRouter();
  const { trackEvent } = useAnalytics();
  const [featuredProducts, setFeaturedProducts] = React.useState<DbProduct[]>([]);
  const [productsLoading, setProductsLoading] = React.useState(true);
  const [productsError, setProductsError] = React.useState<string | null>(null);
  const [showLoader, setShowLoader] = React.useState(true);
  const [typedWord, setTypedWord] = React.useState('');
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const tiltRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setShowLoader(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        setProductsLoading(true);
        setProductsError(null);

        // Pull a few extra records so we can choose ones that actually have images
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

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    const words = ['Future.', 'Home.', 'Business.', 'Assets.'];
    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId: number;

    const step = () => {
      const current = words[wordIndex];
      const nextCharIndex = deleting ? charIndex - 1 : charIndex + 1;
      setTypedWord(current.slice(0, Math.max(0, nextCharIndex)));
      charIndex = nextCharIndex;

      if (!deleting && charIndex === current.length) {
        deleting = true;
        timeoutId = window.setTimeout(step, 1200);
        return;
      }

      if (deleting && charIndex === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        timeoutId = window.setTimeout(step, 400);
        return;
      }

      timeoutId = window.setTimeout(step, deleting ? 80 : 120);
    };

    step();
    return () => window.clearTimeout(timeoutId);
  }, []);

  React.useEffect(() => {
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
  }, []);

  const handleTiltMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltRef.current) return;
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

  const handleBrowseCatalog = () => {
    trackEvent('browse_catalog_click');
    router.push('/products');
  };

  const handleConsultationRequest = () => {
    trackEvent('consultation_request_click');
    router.push('/contact');
  };

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200 selection:bg-cyan-500/40 selection:text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-0 h-[42rem] w-[42rem] rounded-full bg-cyan-500/10 blur-[160px]" />
        <div className="absolute -right-40 top-1/3 h-[46rem] w-[46rem] rounded-full bg-violet-500/10 blur-[180px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.6),_rgba(2,6,23,0.9))]" />
      </div>
      {showLoader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 transition-opacity">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin"></div>
            <p className="text-xs font-semibold tracking-[0.4em] text-cyan-300">INITIALIZING</p>
          </div>
        </div>
      )}

      <section className="relative flex items-center overflow-hidden py-20 sm:py-24">
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />
        <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20 brightness-100 contrast-150" />
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#06b6d4]/20 blur-[100px]" />
        <div className="pointer-events-none absolute right-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-[#8b5cf6]/20 blur-[100px]" />

        <div className="relative z-10 w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 mx-auto">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#06b6d4]/30 bg-[#06b6d4]/5 px-3 py-1 text-xs font-bold tracking-wider text-[#06b6d4] font-tech">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#06b6d4] opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#06b6d4]"></span>
                </span>
                OPERATIONAL IN GOA
              </div>

              <h1 className="text-5xl font-bold leading-tight text-white md:text-7xl font-tech">
                <span className="glitch-text" data-text="Secure Your">Secure Your</span>
                <br />
                <span className="typewriter-cursor bg-gradient-to-r from-[#06b6d4] via-blue-500 to-[#8b5cf6] bg-clip-text text-transparent">
                  {typedWord}
                </span>
              </h1>

              <p className="max-w-lg text-lg leading-relaxed text-slate-400">
                We blend enterprise-grade security with local affordability. From retrofit CCTV to zero-downtime IT infrastructure.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/contact"
                  onMouseMove={applyMagneticEffect}
                  onMouseLeave={resetMagneticEffect}
                  className="magnetic-btn relative inline-flex h-12 overflow-hidden rounded-lg p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]"></span>
                  <span className="inline-flex h-full w-full items-center justify-center rounded-lg bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl transition-colors hover:bg-slate-900">
                    Start Project
                  </span>
                </Link>
                <Link
                  href="/services"
                  onMouseMove={applyMagneticEffect}
                  onMouseLeave={resetMagneticEffect}
                  className="magnetic-btn rounded-lg border border-white/10 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  View Services
                </Link>
              </div>

              <div className="flex gap-8 border-t border-white/5 pt-8">
                <div>
                  <p className="text-2xl font-bold text-white font-tech">100</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Installations</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white font-tech">24/7</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Support</p>
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block" id="hero-visual" onMouseMove={handleTiltMove} onMouseLeave={handleTiltLeave}>
              <div ref={tiltRef} className="tilt-card relative z-10 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 shadow-2xl backdrop-blur-2xl">
                <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <div className="ml-auto text-xs font-mono text-slate-500">system_status.log</div>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10 animate-pulse">
                    <Lock size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Perimeter Secure</p>
                    <p className="text-xs text-slate-500">Live Monitoring Active</p>
                  </div>
                </div>
              </div>
              <div className="absolute -inset-4 -z-10 rounded-2xl bg-[#06b6d4]/20 blur-xl"></div>
            </div>
          </div>
        </div>
      </section>

      <HeroCarousel pageKey="homepage" />

      <section className="bg-slate-950 py-24">
        <div className="container mx-auto px-6">
          <div className="mb-14 max-w-2xl">
            <span className="text-xs uppercase tracking-[0.4em] text-cyan-300">Core pillars</span>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Designed for modern operations.</h2>
            <p className="mt-4 text-sm text-slate-400 sm:text-base">
              A flexible stack that adapts to new infrastructure, new spaces, and new business needs without the noise.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURE_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:border-cyan-400/40 hover:shadow-xl hover:shadow-cyan-500/10"
                style={{
                  '--spotlight-x': '0px',
                  '--spotlight-y': '0px',
                  '--spotlight': 'radial-gradient(600px circle at var(--spotlight-x) var(--spotlight-y), rgba(56,189,248,0.18), transparent 42%)',
                } as React.CSSProperties}
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;
                  event.currentTarget.style.setProperty('--spotlight-x', `${x}px`);
                  event.currentTarget.style.setProperty('--spotlight-y', `${y}px`);
                  event.currentTarget.style.setProperty('--spotlight', `radial-gradient(600px circle at ${x}px ${y}px, rgba(56,189,248,0.18), transparent 42%)`);
                }}
              >
                <div className="absolute inset-0 -z-10" style={{ background: 'var(--spotlight)' }} />
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

      <section className="bg-black/40 py-24">
        <div className="container mx-auto grid gap-12 px-6 lg:grid-cols-2 lg:items-center">
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-10">
            <div className="absolute -left-6 top-10 h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-cyan-500/20 blur-2xl"></div>
            <div className="absolute -bottom-8 right-6 h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-violet-500/20 blur-2xl"></div>
            <h3 className="text-2xl font-semibold text-white sm:text-3xl">Operational clarity, not complexity.</h3>
            <p className="mt-4 text-sm text-slate-400 sm:text-base">
              Build a secure foundation with a service model that keeps technology dependable and aligned with your goals.
            </p>
            <div className="mt-6 grid gap-4">
              {['Unified monitoring', 'Actionable reporting', 'Hands-on lifecycle support'].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  <Layers size={16} className="text-cyan-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <span className="text-xs uppercase tracking-[0.4em] text-cyan-300">Plans</span>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Service tiers built to scale.</h2>
              <p className="mt-4 text-sm text-slate-400 sm:text-base">
                Choose the level of coverage that matches your footprint. Upgrade as your infrastructure grows.
              </p>
            </div>
            <div className="grid gap-4">
              {PLAN_TIERS.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl border px-6 py-5 ${
                    plan.highlight
                      ? 'border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                      : 'border-white/10 bg-white/5'
                  }`}
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

      <section className="bg-slate-950 py-24">
        <div className="container mx-auto px-6">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-[0.4em] text-cyan-300">Storefront</span>
              <h2 className="mt-3 text-3xl font-semibold text-white">Featured hardware</h2>
            </div>
            <button
              type="button"
              onClick={handleBrowseCatalog}
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100"
            >
              Browse catalog <ArrowRight size={16} />
            </button>
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
              featuredProducts.map((product) => {
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
                  <div key={product.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40">
                    <div className="mb-4 flex h-32 sm:h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-900">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={title}
                          loading="lazy"
                          className="h-full w-full object-cover"
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

      <section className="bg-black/60 py-24">
        <div className="container mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-violet-500/10 p-10">
            <div className="absolute -left-20 top-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl"></div>
            <div className="absolute -bottom-20 right-0 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl"></div>
            <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                  <Sparkles size={14} /> Ready when you are
                </span>
                <h3 className="mt-5 text-2xl font-semibold text-white sm:text-3xl">Upgrade your space with confidence.</h3>
                <p className="mt-4 text-sm text-slate-300 sm:text-base">
                  Share your requirements and we will map a secure, scalable setup tailored to your environment.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-center">
                <p className="text-sm text-slate-400">Talk to an advisor</p>
                <button
                  type="button"
                  onClick={handleConsultationRequest}
                  className="mt-4 w-full rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950"
                >
                  Request a consultation
                </button>
                <p className="mt-3 text-xs text-slate-500">Response window: same business day</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}