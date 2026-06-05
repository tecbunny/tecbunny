
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';

import { logger } from '@/lib/logger';

import { useToast } from '../hooks/use-toast';
import HeroCarousel from './HeroCarousel';

interface Offer {
  id: string;
  title: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'free_shipping';
  discount_value?: number;
  minimum_purchase_amount?: number;
  offer_code?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_featured: boolean;
  customer_eligibility: string;
  banner_text?: string;
  banner_color?: string;
  terms_and_conditions?: string;
}

const sanitizeTerms = (raw: string) =>
  DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });

const getReadableTextColor = (hex?: string) => {
  if (!hex) return '#ffffff';
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '#ffffff';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#111827' : '#ffffff';
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [featuredOffers, setFeaturedOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ days: '00', hours: '00', minutes: '00', seconds: '00' });
  const { toast } = useToast();

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      
      // Fetch all active offers
      const offersResponse = await fetch('/api/offers?active=true&homepage=true');
      const offersData = await offersResponse.json();
      
      if (offersResponse.ok) {
        const allOffers = offersData.offers || [];
        setOffers(allOffers);
        setFeaturedOffers(allOffers.filter((offer: Offer) => offer.is_featured));
      }
    } catch (error) {
      logger.error('Error fetching offers:', { error });
    } finally {
      setLoading(false);
    }
  };

  const getDiscountDisplay = (offer: Offer) => {
    switch (offer.discount_type) {
      case 'percentage':
        return `${offer.discount_value}% OFF`;
      case 'fixed_amount':
        return `₹${offer.discount_value} OFF`;
      case 'free_shipping':
        return 'FREE SHIPPING';
      case 'buy_x_get_y':
        return 'BUY X GET Y';
      default:
        return 'SPECIAL OFFER';
    }
  };

  const getTimeLeft = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) return 'Expired';
    if (daysLeft === 1) return 'Ends today';
    if (daysLeft <= 7) return `Ends in ${daysLeft} days`;
    return '';
  };

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown({ days: '00', hours: '00', minutes: '00', seconds: '00' });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown({
        days: String(days).padStart(2, '0'),
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
      });
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const couponOffers = useMemo(() => offers.filter((offer) => Boolean(offer.offer_code)), [offers]);
  const regularOffers = useMemo(
    () => offers.filter((offer) => !offer.is_featured && !offer.offer_code),
    [offers]
  );

  const handleCopyCode = async (code?: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      logger.error('Failed to copy offer code', { error });
      toast({
        title: 'Copy failed',
        description: 'Unable to copy the code. Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
      <div className="pointer-events-none absolute right-1/4 top-0 h-[600px] w-[600px] rounded-full bg-amber-400/10 blur-[140px]" />

      <HeroCarousel pageKey="offers" />

      <section className="relative pt-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
              Limited time deals
            </div>
            <h1 className="mt-6 text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
              Secure More.{' '}
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
                Pay Less.
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
              Exclusive bundles and seasonal discounts on hardware and AMC packages. Engineered for affordability in Goa.
            </p>

            <div className="mt-10 inline-flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur">
              {['days', 'hours', 'minutes', 'seconds'].map((label) => (
                <div key={label} className="text-center">
                  <div className={`text-3xl font-semibold ${label === 'seconds' ? 'text-amber-300' : 'text-white'}`}>
                    {countdown[label as keyof typeof countdown]}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
              Until end of month sale
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-semibold text-white">Hardware Bundles</h2>
              <p className="mt-1 text-sm text-slate-400">Pre-configured kits with installation included.</p>
            </div>
            <Link href="/products" className="text-sm text-cyan-300 hover:text-cyan-200">
              View individual items →
            </Link>
          </div>

          {featuredOffers.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="group relative flex h-full flex-col rounded-2xl border border-white/10 bg-slate-900/70 p-6 transition-colors hover:border-amber-400/50"
                >
                  {offer.banner_text && (
                    <div
                      className="absolute right-4 top-4 rounded-md px-2 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: offer.banner_color || '#f59e0b',
                        color: getReadableTextColor(offer.banner_color || '#f59e0b'),
                      }}
                    >
                      {offer.banner_text}
                    </div>
                  )}
                  <div className="mb-5 flex h-40 items-center justify-center rounded-xl bg-black/40 text-5xl text-slate-700">
                    ★
                  </div>
                  <h3 className="text-xl font-semibold text-white">{offer.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{offer.description}</p>
                  <div className="mt-5 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{getDiscountDisplay(offer)}</span>
                      {getTimeLeft(offer.end_date) && <span>{getTimeLeft(offer.end_date)}</span>}
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-5">
                    <span className="text-lg font-semibold text-white">Claim Bundle</span>
                    <Link
                      href="/products"
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-amber-400/50 hover:bg-amber-400/10"
                    >
                      Claim Deal
                    </Link>
                  </div>
                  {offer.terms_and_conditions && (
                    <div
                      className="prose prose-xs mt-4 max-w-none text-slate-500 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizeTerms(offer.terms_and_conditions) }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
                Featured bundles will appear here soon.
              </div>
            )
          )}
        </div>
      </section>

      {couponOffers.length > 0 && (
        <section className="border-y border-white/5 bg-white/5 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-semibold text-white">Active Coupons</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {couponOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 p-6"
                >
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 [background:linear-gradient(120deg,transparent,rgba(255,255,255,0.08),transparent)] group-hover:opacity-100" />
                  <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
                        %
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{offer.title}</h3>
                        <p className="text-xs text-slate-400">{offer.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Code</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(offer.offer_code)}
                        className="flex items-center gap-2 rounded border border-dashed border-slate-600 bg-slate-950 px-4 py-2 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-300/60"
                      >
                        {copiedCode === offer.offer_code ? 'COPIED' : offer.offer_code}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {regularOffers.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold text-white">More Offers</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {regularOffers.map((offer) => (
                <div key={offer.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-300">{getDiscountDisplay(offer)}</p>
                  <h3 className="mt-3 text-lg font-semibold text-white">{offer.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{offer.description}</p>
                  {offer.minimum_purchase_amount && (
                    <p className="mt-3 text-xs text-slate-500">Minimum purchase: ₹{offer.minimum_purchase_amount}</p>
                  )}
                  <div className="mt-5 flex items-center justify-between">
                    <Link
                      href="/products"
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-amber-400/50"
                    >
                      {offer.discount_type === 'free_shipping' ? 'Shop Now' : 'Claim Offer'}
                    </Link>
                    {offer.offer_code && (
                      <span className="text-xs text-slate-500">Code: {offer.offer_code}</span>
                    )}
                  </div>
                  {offer.terms_and_conditions && (
                    <div
                      className="prose prose-xs mt-4 max-w-none text-slate-500 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizeTerms(offer.terms_and_conditions) }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!loading && offers.length === 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
            No active offers at the moment. Check back soon for new deals.
          </div>
        </section>
      )}
    </div>
  );
}