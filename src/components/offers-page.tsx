
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';

import { logger } from '@/lib/logger';

import { useToast } from '../hooks/use-toast';

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
    <div className="relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
      <div className="pointer-events-none absolute right-1/4 top-0 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[140px]" />

      <section className="relative pt-16 sm:pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Limited time deals
            </div>
            <h1 className="mt-6 text-4xl font-semibold text-foreground sm:text-5xl lg:text-6xl">
              Secure More.{' '}
              <span className="bg-gradient-to-r from-primary via-blue-500 to-indigo-600 bg-clip-text text-transparent">
                Pay Less.
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Exclusive bundles and seasonal discounts on hardware and AMC packages. Engineered for affordability in Goa.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-semibold text-foreground">Hardware Bundles</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pre-configured kits with installation included.</p>
            </div>
            <Link href="/products" className="text-sm text-primary hover:underline font-medium">
              View individual items →
            </Link>
          </div>

          {featuredOffers.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="group relative flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
                >
                  {offer.banner_text && (
                    <div
                      className="absolute right-4 top-4 rounded-md px-2 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: offer.banner_color || '#2563EB',
                        color: getReadableTextColor(offer.banner_color || '#2563EB'),
                      }}
                    >
                      {offer.banner_text}
                    </div>
                  )}
                  <div className="mb-5 flex h-40 items-center justify-center rounded-xl bg-muted text-5xl text-muted-foreground/40">
                    ★
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{offer.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{offer.description}</p>
                  <div className="mt-5 border-t border-border pt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{getDiscountDisplay(offer)}</span>
                      {getTimeLeft(offer.end_date) && <span>{getTimeLeft(offer.end_date)}</span>}
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-5">
                    <span className="text-lg font-semibold text-foreground">Claim Bundle</span>
                    <Link
                      href="/products"
                      className="rounded-lg border border-border bg-muted/50 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
                    >
                      Claim Deal
                    </Link>
                  </div>
                  {offer.terms_and_conditions && (
                    <div
                      className="prose prose-xs mt-4 max-w-none text-muted-foreground [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizeTerms(offer.terms_and_conditions) }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
                Featured bundles will appear here soon.
              </div>
            )
          )}
        </div>
      </section>

      {couponOffers.length > 0 && (
        <section className="border-y border-border bg-card/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-semibold text-foreground">Active Coupons</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {couponOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6"
                >
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 [background:linear-gradient(120deg,transparent,rgba(255,255,255,0.08),transparent)] group-hover:opacity-100" />
                  <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        %
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{offer.title}</h3>
                        <p className="text-xs text-muted-foreground">{offer.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Code</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(offer.offer_code)}
                        className="flex items-center gap-2 rounded border border-dashed border-border bg-background px-4 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary/60"
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
            <h2 className="text-2xl font-semibold text-foreground">More Offers</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {regularOffers.map((offer) => (
                <div key={offer.id} className="rounded-2xl border border-border bg-card p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-primary">{getDiscountDisplay(offer)}</p>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">{offer.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{offer.description}</p>
                  {offer.minimum_purchase_amount && (
                    <p className="mt-3 text-xs text-muted-foreground">Minimum purchase: ₹{offer.minimum_purchase_amount}</p>
                  )}
                  <div className="mt-5 flex items-center justify-between">
                    <Link
                      href="/products"
                      className="rounded-lg border border-border bg-muted/50 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/50"
                    >
                      {offer.discount_type === 'free_shipping' ? 'Shop Now' : 'Claim Offer'}
                    </Link>
                    {offer.offer_code && (
                      <span className="text-xs text-muted-foreground">Code: {offer.offer_code}</span>
                    )}
                  </div>
                  {offer.terms_and_conditions && (
                    <div
                      className="prose prose-xs mt-4 max-w-none text-muted-foreground [&_a]:underline"
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
          <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            No active offers at the moment. Check back soon for new deals.
          </div>
        </section>
      )}
    </div>
  );
}