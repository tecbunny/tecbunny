
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

function getSimplifiedDescription(desc: string | undefined | null): string {
  if (!desc) return 'Premium hardware optimized for reliable performance.';
  const clean = desc
    .replace(/[#*`_\[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const firstSentence = clean.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length > 15 && firstSentence.length < 100) {
    return firstSentence + '.';
  }
  
  if (clean.length > 85) {
    return clean.slice(0, 82) + '...';
  }
  return clean || 'Premium hardware optimized for reliable performance.';
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
      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 text-center text-zinc-600 transition-colors duration-300 group-hover:border-zinc-700">
        <div className="px-4">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-sm font-semibold text-zinc-500">
            {initial}
          </div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">No Image</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl border border-zinc-900 bg-zinc-950/40 p-1.5 transition-all duration-300 group-hover:border-zinc-800">
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-white p-3 shadow-inner">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain transition-all duration-500 ease-out group-hover:scale-[1.04]"
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
        <div className="flex min-h-[320px] flex-col justify-center rounded-3xl border border-dashed border-white/[0.08] bg-neutral-900/40 p-5 text-center text-xs text-neutral-400">
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
    <section className="relative min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-zinc-800 selection:text-white">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* Subtle Glows */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[350px] w-[600px] -translate-x-1/2 bg-zinc-500/5 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-24 sm:px-8 sm:pt-32">
        <div className="flex flex-col gap-12">
          {/* Hero Header */}
          <div className="reveal-section flex flex-col items-center text-center gap-6" data-reveal-id="products-hero">
            <div className={cn('reveal-item flex flex-col items-center gap-4', revealDelayClass(0))}>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950 px-3.5 py-1 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                Product Catalog
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl leading-[1.1] text-balance">
                Professional Hardware. <br className="hidden sm:inline" />
                <span className="text-zinc-500">Built to endure.</span>
              </h1>
              <p className="max-w-md text-sm text-zinc-400/90 leading-relaxed font-light">
                {searchQuery 
                  ? `Showing results for "${searchQuery}"` 
                  : 'Enterprise-grade equipment and components curated for professional installations and IT infrastructure.'
                }
              </p>
            </div>

            {/* Command-bar style search */}
            <form onSubmit={handleSearch} className={cn('reveal-item w-full max-w-lg mt-4', revealDelayClass(90))}>
              <div className="relative group shadow-2xl rounded-xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-zinc-300" />
                <input
                  type="text"
                  placeholder="Search catalog... (e.g. CCTV, RAM, Router)"
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950/80 pl-10 pr-16 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:bg-zinc-950 transition-all duration-300 font-mono"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/50 text-[9px] font-mono text-zinc-500 pointer-events-none">
                  <span>⏎</span>
                </div>
              </div>
              <p className="mt-2.5 text-[10px] font-mono text-zinc-500 tracking-wider uppercase">{resolvedResultsLabel}</p>
            </form>
          </div>

          {/* Control Bar (Category Filter + Sort Options) */}
          {categories.length > 0 && (
            <div 
              className="reveal-section sticky top-[64px] z-20 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-b border-zinc-900 bg-black/80 backdrop-blur-md py-4 px-2"
              data-reveal-id="products-filters"
            >
              {/* Categories scrollable list */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar py-1">
                <button
                  type="button"
                  onClick={() => updateUrlParams({ category: '' })}
                  className={cn(
                    'reveal-item rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 border whitespace-nowrap',
                    !categoryFilter
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-900/40',
                    revealDelayClass(0)
                  )}
                >
                  All Products
                </button>
                {categories.map((category, idx) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => updateUrlParams({ category })}
                    className={cn(
                      'reveal-item rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 border whitespace-nowrap',
                      categoryFilter === category
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        : 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-900/40',
                      revealDelayClass(50 + idx * 20)
                    )}
                  >
                    {category}
                  </button>
                ))}
                {categoryFilter && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={cn(
                      'reveal-item rounded-lg border border-red-950 bg-red-950/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all duration-200 hover:bg-red-950/40 hover:text-red-300',
                      revealDelayClass(120)
                    )}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Sort by</span>
                <select
                  value={sortOption}
                  onChange={(e) => updateUrlParams({ sort: e.target.value })}
                  className="bg-zinc-950 text-xs text-zinc-300 border border-zinc-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-700 hover:bg-zinc-900 transition-colors font-mono cursor-pointer"
                >
                  <option value="popularity">Popularity</option>
                  <option value="newest">New Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="name_asc">Name: A to Z</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Product Grid Area */}
        <div className="reveal-section is-revealed mt-16" data-reveal-id="products-grid">
          {loading ? (
            <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(250px,1fr))] min-h-[400px]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex h-full flex-col rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6">
                  <Skeleton className="mb-6 aspect-square w-full rounded-xl bg-zinc-900/60 animate-pulse" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-1/4 bg-zinc-900/60 rounded animate-pulse" />
                    <Skeleton className="h-5 w-3/4 bg-zinc-900/60 rounded animate-pulse" />
                    <Skeleton className="h-4 w-5/6 bg-zinc-900/60 rounded animate-pulse" />
                  </div>
                  <div className="mt-8 flex items-center justify-between pt-4 border-t border-zinc-900">
                    <div className="flex flex-col gap-1 w-20">
                      <Skeleton className="h-6 w-full bg-zinc-900/60 rounded animate-pulse" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-lg bg-zinc-900/60 rounded animate-pulse" />
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

                const simpleDesc = getSimplifiedDescription(product.description);

                return (
                  <ProductTileErrorBoundary key={product.id || index} productId={product.id}>
                    <div
                      className="group relative flex h-full flex-col justify-between rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-800 hover:bg-zinc-950/60 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
                    >
                      <Link href={`/products/${product.id}`} className="block flex-grow">
                        {/* Image Frame */}
                        <div className="relative mb-6 aspect-square overflow-hidden rounded-xl bg-zinc-950 border border-zinc-900/50">
                          <ProductGridImage
                            src={imageUrl}
                            alt={displayName}
                            fallbackText={displayName}
                          />
                          {/* Discount Badge */}
                          {product.discount_percentage && product.discount_percentage > 0 ? (
                            <div className="absolute left-3 top-3 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 text-[9px] font-mono font-bold text-cyan-400 tracking-wider uppercase shadow-sm animate-fade-in">
                              -{product.discount_percentage}% OFF
                            </div>
                          ) : null}
                        </div>

                        {/* Text Content */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">
                              {product.brand || product.category || 'Hardware'}
                            </span>
                            {product.rating > 0 && (
                              <div className="flex items-center gap-0.5 text-[10px] font-mono text-zinc-400">
                                <span>★</span>
                                <span>{product.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                          
                          <h3 className="text-base font-semibold tracking-tight text-white transition-colors group-hover:text-zinc-200">
                            {displayName}
                          </h3>
                          
                          <p className="text-xs font-light text-zinc-400 line-clamp-2 leading-relaxed">
                            {simpleDesc}
                          </p>
                        </div>
                      </Link>

                      {/* Footer Actions */}
                      <div className="mt-6 flex items-center justify-between pt-4 border-t border-zinc-900">
                        <div className="flex flex-col">
                          <span className="text-lg font-bold tracking-tight text-white">
                            ₹{(offerPrice ?? basePrice).toLocaleString('en-IN')}
                          </span>
                          {offerPrice && (
                            <span className="text-xs text-zinc-600 line-through font-light">
                              ₹{basePrice.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            addToCart(product);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-850 bg-zinc-900/40 text-zinc-300 transition-all duration-200 hover:border-cyan-500/30 hover:bg-cyan-500 hover:text-zinc-950 hover:scale-105"
                          aria-label={`Add ${displayName} to cart`}
                        >
                          <span className="text-base font-light">+</span>
                        </button>
                      </div>
                    </div>
                  </ProductTileErrorBoundary>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-850 bg-zinc-950/20 p-12 text-center text-zinc-500 font-light text-sm">
              {fetchWarning || 'No products matched your search.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
