
'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

import { 
  Search
} from 'lucide-react';

import { logger } from '@/lib/logger';
import { getProductDisplayImage } from '@/lib/image-utils';
import { cn, revealDelayClass } from '@/lib/utils';

import type { Product, AutoOffer } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useCart } from '@/lib/hooks';
import { useRevealSections } from '../../hooks/use-reveal-sections';
import HeroCarousel from '../HeroCarousel';

const DEFAULT_CUSTOMER_CATEGORY = 'Normal';

async function fetchActiveAutoOffers(): Promise<AutoOffer[]> {
  try {
    const response = await fetch('/api/auto-offers?active=true', { cache: 'no-store' });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`Failed to fetch auto offers (${response.status}): ${bodyText}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload)) {
      return payload as AutoOffer[];
    }
    if (Array.isArray(payload?.data)) {
      return payload.data as AutoOffer[];
    }
    return [];
  } catch (error) {
    logger.warn('ShopPage: Active auto offers fetch failed', { error });
    return [];
  }
}

function isOfferCurrentlyValid(offer: AutoOffer, reference: Date): boolean {
  const validFrom = offer.conditions?.valid_from ? new Date(offer.conditions.valid_from) : null;
  if (validFrom && Number.isFinite(validFrom.getTime()) && validFrom > reference) {
    return false;
  }

  const validTo = offer.conditions?.valid_to ? new Date(offer.conditions.valid_to) : null;
  if (validTo && Number.isFinite(validTo.getTime()) && validTo < reference) {
    return false;
  }

  return true;
}

function doesOfferApplyToProduct(offer: AutoOffer, product: Product): boolean {
  const conditions = offer.conditions || {};

  if (Array.isArray(conditions.customer_category) && conditions.customer_category.length > 0) {
    if (!conditions.customer_category.includes(DEFAULT_CUSTOMER_CATEGORY)) {
      return false;
    }
  }

  if (conditions.minimum_order_value && product.price < conditions.minimum_order_value) {
    return false;
  }

  if (Array.isArray(conditions.applicable_categories) && conditions.applicable_categories.length > 0) {
    const productCategory = (product.category || '').toLowerCase();
    const matchesCategory = conditions.applicable_categories.some((category) =>
      typeof category === 'string' && category.toLowerCase() === productCategory
    );
    if (!matchesCategory) {
      return false;
    }
  }

  if (Array.isArray(conditions.applicable_product_ids) && conditions.applicable_product_ids.length > 0) {
    if (!conditions.applicable_product_ids.includes(product.id)) {
      return false;
    }
  }

  return true;
}

function calculateOfferPriceForProduct(price: number, offer: AutoOffer): number {
  const candidates = [price];
  const percentage = typeof offer.discount_percentage === 'number'
    ? offer.discount_percentage
    : Number(offer.discount_percentage);
  if (Number.isFinite(percentage) && percentage > 0) {
    candidates.push(price * (1 - Math.min(percentage, 90) / 100));
  }

  const fixedAmount = typeof offer.discount_amount === 'number'
    ? offer.discount_amount
    : Number(offer.discount_amount);
  if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
    candidates.push(price - fixedAmount);
  }

  let discounted = Math.min(...candidates);

  if (offer.max_discount_amount && offer.max_discount_amount > 0) {
    discounted = Math.max(discounted, price - offer.max_discount_amount);
  }

  return Math.max(0, discounted);
}

function applyAutoOffersToProducts(products: Product[], offers: AutoOffer[]): Product[] {
  const now = new Date();
  const safeOffers = offers.filter((offer) => offer?.is_active && offer.auto_apply);

  return products.map((product) => {
    const basePrice = product.price;
    const existingOfferPrice = typeof product.offer_price === 'number' && product.offer_price > 0
      ? product.offer_price
      : basePrice;

    let bestPrice = existingOfferPrice;
    let appliedOffer: AutoOffer | null = null;

    for (const offer of safeOffers) {
      if (!isOfferCurrentlyValid(offer, now)) {
        continue;
      }
      if (!doesOfferApplyToProduct(offer, product)) {
        continue;
      }

      const candidatePrice = calculateOfferPriceForProduct(basePrice, offer);
      if (candidatePrice < bestPrice) {
        bestPrice = candidatePrice;
        appliedOffer = offer;
      }
    }

    const effectiveDiscount = basePrice > 0
      ? Math.max(0, Math.round(((basePrice - bestPrice) / basePrice) * 100))
      : 0;

    if (appliedOffer || (existingOfferPrice < basePrice && effectiveDiscount > 0)) {
      return {
        ...product,
        offer_price: Math.round(bestPrice),
        discount_percentage: effectiveDiscount,
        applied_offer_title: appliedOffer?.title ?? product.applied_offer_title,
        applied_offer_id: appliedOffer?.id ?? product.applied_offer_id,
      };
    }

    // Ensure explicit offer_price still updates discount percentage
    if (!product.discount_percentage && existingOfferPrice < basePrice) {
      return {
        ...product,
        offer_price: Math.round(existingOfferPrice),
        discount_percentage: effectiveDiscount,
      };
    }

    return product;
  });
}

function ProductGridImage({
  src,
  alt,
  fallbackText,
}: {
  src: string | null | undefined;
  alt: string;
  fallbackText: string;
}) {
  const [hasImageError, setHasImageError] = React.useState(false);
  const initial = fallbackText.trim().charAt(0).toUpperCase() || 'P';

  if (!src || hasImageError) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-slate-950/60 text-center text-slate-500">
        <div className="px-4">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-lg font-semibold text-slate-300">
            {initial}
          </div>
          <p className="text-sm font-medium text-slate-300">Image unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-[18px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_rgba(15,23,42,0.92)_62%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-white p-3">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          onError={() => setHasImageError(true)}
        />
      </div>
    </div>
  );
}

class ProductTileErrorBoundary extends React.Component<
  React.PropsWithChildren<{ productId?: string }>,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logger.error('ShopPage: product tile render failed', { error, productId: this.props.productId });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[320px] flex-col justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/60 p-4 text-center text-sm text-slate-400">
          Product unavailable
        </div>
      );
    }

    return this.props.children;
  }
}

interface ShopPageContentProps {
  initialRawProducts?: any[];
  initialRawAutoOffers?: any[];
}

function normalizeRawProduct(p: any): Product {
  const rawPrice = typeof p.price === 'number' ? p.price : Number(p.price) || 0;
  const rawMrp = typeof p.mrp === 'number' ? p.mrp : Number(p.mrp) || (rawPrice * 1.2);

  const resolvedTitle = [p.title, p.name]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0) || 'Unnamed Product';

  // Get valid display image using utility function
  const finalImage = getProductDisplayImage(
    { ...p, title: resolvedTitle, name: resolvedTitle },
    {
      fallbackText: resolvedTitle,
      fallbackSize: '400x400',
    }
  );

  const rawHsn =
    p.hsnCode ??
    (p as any).hsn_code ??
    (p as any).hsn ??
    (p as any).hsn_sac ??
    null;
  const rawGst =
    p.gstRate ??
    (p as any).gst_rate ??
    (p as any).gst_percentage ??
    null;

  let resolvedGst: number | undefined;
  if (typeof rawGst === 'number' && Number.isFinite(rawGst)) {
    resolvedGst = rawGst;
  } else if (typeof rawGst === 'string') {
    const parsed = Number.parseFloat(rawGst);
    resolvedGst = Number.isFinite(parsed) ? parsed : undefined;
  }

  const gstRate = resolvedGst ?? 18;
  const priceNum = Math.round(rawPrice * (1 + gstRate / 100));
  const mrpNum = Math.round(rawMrp * (1 + gstRate / 100));

  const resolvedHsn = typeof rawHsn === 'string' && rawHsn.trim().length > 0
    ? rawHsn.trim()
    : undefined;

  return {
    ...p,
    id: p.id,
    name: resolvedTitle,
    title: resolvedTitle,
    category: p.category || p.product_type || 'General',
    brand: p.brand || p.vendor || undefined,
    price: priceNum,
    mrp: mrpNum,
    popularity: p.popularity || 0,
    rating: p.rating || 0,
    reviewCount: p.review_count ?? p.reviewCount ?? 0,
    created_at: p.created_at || new Date().toISOString(),
    image: finalImage || undefined,
    hsnCode: resolvedHsn,
    gstRate: gstRate,
  } as Product;
}

export function ShopPageContent({ initialRawProducts, initialRawAutoOffers }: ShopPageContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const searchQuery = searchParams.get('q') || '';
  const sortOption = searchParams.get('sort') || 'newest';
  const categoryFilter = searchParams.get('category') || '';
  const brandFilter = searchParams.get('brand') || '';
  const refresh = searchParams.get('refresh') || '';
  
  const initialEnrichedProducts = React.useMemo(() => {
    if (initialRawProducts && initialRawProducts.length > 0) {
      const normalized = initialRawProducts.map(normalizeRawProduct);
      return applyAutoOffersToProducts(normalized, initialRawAutoOffers || []);
    }
    return [];
  }, [initialRawProducts, initialRawAutoOffers]);

  const [products, setProducts] = React.useState<Product[]>(initialEnrichedProducts);
  const [filteredProducts, setFilteredProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(!initialRawProducts || initialRawProducts.length === 0);
  const [fetchWarning, setFetchWarning] = React.useState<string | null>(null);
  
  const [categories, setCategories] = React.useState<string[]>(() => {
    if (initialEnrichedProducts.length > 0) {
      return [...new Set(initialEnrichedProducts.map(p => p.category).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    }
    return [];
  });
  
  const [priceRange, setPriceRange] = React.useState<[number, number]>(() => {
    if (initialEnrichedProducts.length > 0) {
      const prices = initialEnrichedProducts.map(p => p.price);
      return [Math.min(...prices), Math.max(...prices)];
    }
    return [0, 100000];
  });
  
  const [maxPrice, setMaxPrice] = React.useState(() => {
    if (initialEnrichedProducts.length > 0) {
      return Math.max(...initialEnrichedProducts.map(p => p.price));
    }
    return 100000;
  });
  
  const [localSearchQuery, setLocalSearchQuery] = React.useState(searchQuery);
  const { addToCart } = useCart();
  useRevealSections('[data-reveal-id]', filteredProducts.length);
  
  // Update URL parameters
  const updateUrlParams = React.useCallback((params: Record<string, string>) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        currentParams.set(key, value);
      } else {
        currentParams.delete(key);
      }
    });
    
    const queryString = currentParams.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  // Fetch products from database
  React.useEffect(() => {
    if (initialRawProducts && initialRawProducts.length > 0) {
      return;
    }
    const fetchProducts = async () => {
      setLoading(true);
      setFetchWarning(null);
      
      try {
        logger.info('ShopPage: Fetching products...');
        const response = await fetch('/api/products?status=active&limit=200', { cache: 'no-store' });
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`Products fetch failed (${response.status}): ${body}`);
        }

        const payload = await response.json();
        const warningMessage = Array.isArray(payload?.warnings) && payload.warnings.length > 0
          ? String(payload.warnings[0])
          : null;
        const data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];

        logger.info('ShopPage: Products fetched', {
          count: data?.length || 0,
          hasData: !!data
        });

        if (!data || data.length === 0) {
          if (warningMessage) {
            logger.warn('Products API warning with empty dataset', { warning: warningMessage });
            setFetchWarning(warningMessage);
          } else {
            logger.warn('No products found in database');
          }
          setProducts([]);
          setCategories([]);
          setLoading(false);
          return;
        }
        
        // Normalize products to ensure required fields exist and are properly typed
        const normalized = data.map(normalizeRawProduct);

        logger.info('ShopPage: Products normalized', { count: normalized.length });

        const activeOffers = normalized.length > 0 ? await fetchActiveAutoOffers() : [];
        const enrichedProducts = applyAutoOffersToProducts(normalized, activeOffers);

        setProducts(enrichedProducts);
        
        // Extract unique categories and brands
        const uniqueCategories = [...new Set(enrichedProducts.map(p => p.category).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b));
        setCategories(uniqueCategories);
        
        // Set price range based on actual product prices
        if (enrichedProducts.length === 0) {
          setMaxPrice(100000);
          setPriceRange([0, 100000]);
        } else {
          const prices = enrichedProducts.map(p => p.price);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          setMaxPrice(max);
          setPriceRange([min, max]);
        }
      } catch (error) {
        logger.error('Error fetching products:', { error });
        setFetchWarning(error instanceof Error ? error.message : 'Unable to load products right now.');
        setProducts([]);
      } finally {
        // Always set loading to false, even if there's an error
        setLoading(false);
        logger.info('ShopPage: Loading complete');
      }
    };

    fetchProducts();
  }, [refresh, initialRawProducts]);

  // Filter and sort products
  React.useEffect(() => {
    let filtered = [...products];

    // Apply filters
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.brand || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    if (brandFilter) {
      filtered = filtered.filter(product => product.brand === brandFilter);
    }

    // Price range filter
    filtered = filtered.filter(product => 
      product.price >= priceRange[0] && product.price <= priceRange[1]
    );

    // Apply sorting
    switch (sortOption) {
      case 'price_asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'name_asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'popularity':
      default:
        filtered.sort((a, b) => b.popularity - a.popularity);
    }

    setFilteredProducts(filtered);
  }, [products, searchQuery, categoryFilter, brandFilter, priceRange, sortOption]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ q: localSearchQuery });
  };

  const clearFilters = () => {
    setPriceRange([0, maxPrice]);
    updateUrlParams({ 
      category: '', 
      brand: '', 
      q: '',
      sort: 'popularity' 
    });
    setLocalSearchQuery('');
  };

  const hasActiveCategory = Boolean(categoryFilter);
  const resolvedResultsLabel = loading ? 'Loading...' : `${filteredProducts.length} items`;

  return (
    <section className="relative overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
      <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <HeroCarousel pageKey="products" />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-0 sm:px-6 lg:px-8 sm:pt-0">
        <div className="flex flex-col gap-10">
          <div className="reveal-section flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between" data-reveal-id="products-hero">
            <div className={cn('reveal-item', revealDelayClass(0))}>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Catalog
              </div>
              <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
                Hardware <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">Inventory</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
                {searchQuery ? `Results for "${searchQuery}"` : 'Explore verified equipment across every deployment size.'}
              </p>
            </div>

            <form onSubmit={handleSearch} className={cn('reveal-item w-full max-w-md', revealDelayClass(90))}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:bg-white/10"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">{resolvedResultsLabel}</p>
            </form>
          </div>

          {categories.length > 0 && (
            <div className="reveal-section flex flex-wrap gap-2" data-reveal-id="products-filters">
              <button
                type="button"
                onClick={() => updateUrlParams({ category: '' })}
                className={cn(
                  'reveal-item rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                  hasActiveCategory
                    ? 'border-white/10 text-slate-400 hover:border-cyan-400/40 hover:text-white'
                    : 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300',
                  revealDelayClass(0)
                )}
              >
                All Items
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => updateUrlParams({ category })}
                  className={cn(
                    'reveal-item rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                    categoryFilter === category
                      ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-white/10 text-slate-400 hover:border-cyan-400/40 hover:text-white',
                    revealDelayClass(70)
                  )}
                >
                  {category}
                </button>
              ))}
              {categoryFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={cn('reveal-item rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-white', revealDelayClass(140))}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="reveal-section is-revealed mt-12" data-reveal-id="products-grid">
          {loading ? (
            <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(250px,1fr))] min-h-[400px]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex h-full flex-col rounded-2xl border border-white/5 bg-slate-900/60 p-4">
                  <Skeleton className="mb-4 h-48 w-full rounded-xl" />
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
              {filteredProducts.map((product, index) => {
                const displayName = product.title || product.name || 'Product';
                const imageUrl = getProductDisplayImage(product, {
                  fallbackText: displayName,
                  fallbackSize: '400x400',
                });
                const basePrice = typeof product.price === 'number' ? product.price : Number(product.price) || 0;
                
                // Ensure proper numeric parsing to avoid NaN rendering crashes if unstructured tier text leaks through
                const tierVal = (product as any)?.pricing?.tiers?.[0]?.discount;
                const activeTierPrice = tierVal != null ? Number(tierVal) || basePrice : basePrice;

                let offerPrice = typeof product.offer_price === 'number' && product.offer_price > 0 && product.offer_price < basePrice
                  ? product.offer_price
                  : null;
                
                if (!offerPrice && activeTierPrice < basePrice) {
                  offerPrice = activeTierPrice;
                }

                return (
                  <ProductTileErrorBoundary key={product.id || index} productId={product.id}>
                    <div
                    className={cn(
                      'group flex h-full flex-col rounded-2xl border border-white/5 bg-slate-900/60 p-4 opacity-100 transition-transform duration-300 hover:-translate-y-1 hover:border-cyan-400/30'
                    )}
                  >
                    <Link href={`/products/${product.id}`} className="block">
                      <div className="relative mb-4 h-48 overflow-hidden rounded-xl">
                        <ProductGridImage
                          src={imageUrl}
                          alt={displayName}
                          fallbackText={displayName}
                        />
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold text-white">{displayName}</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {product.brand ? `${product.brand} • ` : ''}
                        {product.category || 'General'}
                      </p>
                    </Link>

                    <div className="mt-auto flex items-center justify-between pt-4">
                      <div className="flex flex-col">
                        <span className="text-lg font-semibold text-cyan-300">₹{(offerPrice ?? basePrice).toLocaleString()}</span>
                        {offerPrice && (
                          <span className="text-xs text-slate-500 line-through">₹{basePrice.toLocaleString()}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          addToCart(product);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10"
                        aria-label={`Add ${displayName} to cart`}
                      >
                        +
                      </button>
                    </div>
                    </div>
                  </ProductTileErrorBoundary>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
              {fetchWarning || 'No products matched your search.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
