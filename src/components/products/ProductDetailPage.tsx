'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Share2, Shield, Truck } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize-html';

import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WishlistButton } from '@/components/wishlist/WishlistButton';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';
import { isPubliclyVisibleProduct } from '@/lib/product-visibility';
import type { Product } from '@/lib/types';
import { useAnalytics } from '../../hooks/use-analytics';
import { useToast } from '../../hooks/use-toast';
import { useBehavioralCRO } from '../../hooks/use-behavioral-cro';
import { StarRating } from './StarRating';

interface ProductDetailPageProps {
  productId: string;
  initialProduct?: any;
  sourceContext?: {
    source: string;
    ref: string | null;
    platform: string;
    timestamp: number;
  } | null;
}

export function ProductDetailPage({ productId, initialProduct, sourceContext }: ProductDetailPageProps) {
  const router = useRouter();
  const { trackEvent } = useAnalytics();
  const { toast } = useToast();
  const { showAssistance, triggerContext, dismissAssistance } = useBehavioralCRO();
  const isMountedRef = useRef(true);

  const initialEnrichedProduct = useMemo(() => {
    if (initialProduct) {
      const p = initialProduct;
      
      // Apply source-aware pricing logic
      let discountMultiplier = 1;
      if (sourceContext?.source === 'certified-agents') {
        discountMultiplier = 0.95; // 5% specialized discount for certified agent traffic
      } else if (sourceContext?.platform === 'app-link') {
        discountMultiplier = 0.98; // 2% app-referral discount
      }

      const resolvedTitle = [p.title, p.name]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .find((value) => value.length > 0) || 'Product';

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

      const resolvedHsn = typeof rawHsn === 'string' && rawHsn.trim().length > 0
        ? rawHsn.trim()
        : undefined;

      const gstRate = resolvedGst ?? 18;
      const rawPrice = typeof p.price === 'number' ? p.price : Number(p.price) || 0;
      const rawMrp = typeof p.mrp === 'number' ? p.mrp : Number(p.mrp) || (rawPrice * 1.2);
      
      const priceNum = Math.round(rawPrice * (1 + gstRate / 100));
      const mrpNum = Math.round(rawMrp * (1 + gstRate / 100));

      return {
        ...p,
        title: resolvedTitle,
        name: resolvedTitle,
        price: priceNum,
        mrp: mrpNum,
        hsnCode: resolvedHsn,
        gstRate: gstRate,
      } as Product;
    }
    return null;
  }, [initialProduct]);

  const [product, setProduct] = useState<Product | null>(initialEnrichedProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [selectedImage, setSelectedImage] = useState(0);
  const [activeTab, setActiveTab] = useState<'specs' | 'description' | 'warranty'>('specs');
  const supabase = createClient();
  const displayName = product?.title || product?.name || 'Product';

  const skuValue = useMemo(() => {
    if (!product) return '';
    return product.handle || product.barcode || product.id;
  }, [product]);

  const productImages = useMemo(() => {
    if (!product) return [];

    const images: string[] = [];

    if (product.image) {
      images.push(product.image);
    }

    const normalizedArray: string[] = Array.isArray((product as any).images)
      ? (product as any).images.map((img: any) => (typeof img === 'string' ? img : img?.url || '')).filter(Boolean)
      : [];
    images.push(...normalizedArray);

    if ((product as any).additional_images && Array.isArray((product as any).additional_images)) {
      const additionalNormalized = (product as any).additional_images
        .map((img: any) => (typeof img === 'string' ? img : img?.url || ''))
        .filter(Boolean);
      images.push(...additionalNormalized);
    }

    const uniqueImages = [...new Set(images)];

    const toPngPlaceholder = (size: string = '600x600') =>
      `https://placehold.co/${size}/0066cc/ffffff.png?text=Product+Image`;
    const ensurePng = (url: string): string => {
      if (!url) return toPngPlaceholder();
      try {
        if (url.endsWith('.svg') || url.includes('image/svg+xml') || url.startsWith('data:image/svg+xml')) {
          return toPngPlaceholder();
        }
        if (url.includes('placehold.co')) {
          const u = new URL(url);
          const hasRasterExt = /\.(png|jpg|jpeg|webp)$/i.test(u.pathname);
          if (!hasRasterExt) {
            u.pathname = `${u.pathname}.png`;
          }
          return u.toString();
        }
        return url;
      } catch {
        return toPngPlaceholder();
      }
    };

    const finalized = uniqueImages.length === 0 ? [toPngPlaceholder()] : uniqueImages;

    return finalized.map(ensurePng);
  }, [product]);

  const descriptionHtml = useMemo(() => {
    if (!product) {
      return '';
    }

    const fallbackText = `Experience the best in ${product.category} technology with the ${displayName}. This premium product combines cutting-edge features with exceptional build quality to deliver outstanding performance and reliability. Perfect for both professionals and enthusiasts who demand the very best.`;

    const rawDescription = (product.description && product.description.trim().length > 0)
      ? product.description
      : `<p>${fallbackText}</p>`;

    return sanitizeHtml(rawDescription);
  }, [product, displayName]);

  const pricing = useMemo(() => {
    if (!product) return null;

    const salePrice = typeof product.price === 'number' ? product.price : 0;
    const rawMrp = typeof (product as any).mrp === 'number' ? (product as any).mrp : null;
    const mrp = rawMrp && rawMrp > 0 ? rawMrp : Math.round(salePrice * 1.2 * 100) / 100;
    const hasDiscount = mrp > salePrice;
    const savingsAmount = hasDiscount ? mrp - salePrice : 0;
    const percentageOff = hasDiscount && mrp !== 0
      ? Math.round(((mrp - salePrice) / mrp) * 100)
      : 0;

    return {
      salePrice,
      mrp,
      hasDiscount,
      savingsAmount,
      percentageOff,
    };
  }, [product]);

  const highlightSpecs = useMemo(() => {
    if (!product?.specifications) return [] as Array<[string, string]>;
    return Object.entries(product.specifications).slice(0, 3) as Array<[string, string]>;
  }, [product]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initialProduct) {
      return;
    }
    const fetchProduct = async () => {
      if (isMountedRef.current) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (!isMountedRef.current) {
        return;
      }

      if (error) {
        logger.error('Error fetching product:', { error });
      } else if (!isPubliclyVisibleProduct(data)) {
        logger.warn('Hidden public product fetch rejected:', { productId });
        setProduct(null);
      } else {
        logger.info('Fetched product data:', {
          id: data.id,
          image: data.image,
          additional_images: data.additional_images,
          additional_images_type: typeof data.additional_images,
          images: data.images,
          hasAdditionalImages: Array.isArray(data.additional_images),
          additionalImagesLength: Array.isArray(data.additional_images) ? data.additional_images.length : 'not array'
        });

        if (data.additional_images && typeof data.additional_images === 'string') {
          try {
            data.additional_images = JSON.parse(data.additional_images);
            logger.info('Parsed additional_images from string:', data.additional_images as any);
          } catch (e) {
            logger.warn('Failed to parse additional_images string:', { error: e });
          }
        }

        const resolvedTitle = [data.title, data.name]
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .find((value) => value.length > 0) || 'Product';

        const rawHsn =
          (data as any).hsnCode ??
          (data as any).hsn_code ??
          (data as any).hsn ??
          (data as any).hsn_sac ??
          null;
        const rawGst =
          (data as any).gstRate ??
          (data as any).gst_rate ??
          (data as any).gst_percentage ??
          null;

        let resolvedGst: number | undefined;
        if (typeof rawGst === 'number' && Number.isFinite(rawGst)) {
          resolvedGst = rawGst;
        } else if (typeof rawGst === 'string') {
          const parsed = Number.parseFloat(rawGst);
          resolvedGst = Number.isFinite(parsed) ? parsed : undefined;
        }

        const resolvedHsn = typeof rawHsn === 'string' && rawHsn.trim().length > 0
          ? rawHsn.trim()
          : undefined;

        const gstRate = resolvedGst ?? 18;
        const rawPrice = typeof data.price === 'number' ? data.price : Number(data.price) || 0;
        const rawMrp = typeof data.mrp === 'number' ? data.mrp : Number(data.mrp) || (rawPrice * 1.2);
        
        const priceNum = Math.round(rawPrice * (1 + gstRate / 100));
        const mrpNum = Math.round(rawMrp * (1 + gstRate / 100));

        setProduct({
          ...data,
          title: resolvedTitle,
          name: resolvedTitle,
          price: priceNum,
          mrp: mrpNum,
          hsnCode: resolvedHsn,
          gstRate: gstRate,
        });
      }
      setLoading(false);
    };

    fetchProduct();
  }, [productId, supabase, initialProduct]);

  const handleShare = async () => {
    if (!product) return;
    const url = window.location.href;
    trackEvent('product_share', { productId: product.id, productName: displayName });

    try {
      if (navigator.share) {
        await navigator.share({
          title: displayName,
          text: `Check out ${displayName} on TecBunny`,
          url,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast({
          title: 'Link copied',
          description: 'Product link copied to clipboard.',
        });
        return;
      }

      toast({
        title: 'Share this link',
        description: url,
      });
    } catch (error) {
      logger.error('product_share_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast({
        variant: 'destructive',
        title: 'Share failed',
        description: 'Please try again or copy the URL manually.',
      });
    }
  };

  if (loading) {
    return (
      <div className="tech-main-content bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-6 w-40 rounded bg-white/10 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-[420px] rounded-2xl bg-white/5"></div>
              <div className="space-y-4">
                <div className="h-8 rounded bg-white/10 w-3/4"></div>
                <div className="h-4 rounded bg-white/10 w-1/2"></div>
                <div className="h-12 rounded bg-white/10 w-2/3"></div>
                <div className="h-32 rounded bg-white/5"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="relative overflow-hidden bg-[#09090B] text-zinc-200 selection:bg-blue-500/20 selection:text-white min-h-screen font-sans antialiased">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Product Not Found</h2>
            <p className="text-muted-foreground mb-8">
              The product you're looking for doesn't exist or has been removed.
            </p>
            <Button type="button" onClick={() => router.push('/products')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-background text-foreground selection:bg-primary/20 selection:text-white min-h-screen font-sans antialiased">
      {/* Background Noise and Grid (homepage style) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
        <div className="absolute -left-40 top-0 h-[42rem] w-[42rem] rounded-full bg-primary/5 blur-[160px]" />
        <div className="absolute -right-40 top-1/3 h-[46rem] w-[46rem] rounded-full bg-muted/5 blur-[180px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(var(--background),0.6),_rgba(var(--background),0.95))]" />
      </div>
      
      {/* Ambient Blobs */}
      <div className="ambient-blob pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-[120px] animate-pulse" aria-hidden="true" />
      <div className="ambient-blob ambient-blob--delayed pointer-events-none absolute right-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" aria-hidden="true" />

      <div className="relative">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 relative z-10">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground/80">
            <button
              type="button"
              onClick={() => router.push('/products')}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Products
            </button>
            <span>/</span>
            <span className="hover:text-primary transition-colors">{product.category}</span>
            <span>/</span>
            <span className="text-foreground font-semibold">{displayName}</span>
          </nav>

          <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="relative bg-muted/20 border border-border rounded-3xl p-8 h-[550px] flex items-center justify-center overflow-hidden group backdrop-blur-sm shadow-2xl">
                <div className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="product-scan-line bg-gradient-to-b from-transparent via-primary/30 to-transparent"></div>
                  <div className="absolute inset-0 bg-primary/5"></div>
                </div>

                <img
                  src={productImages[selectedImage]}
                  alt={displayName}
                  width={900}
                  height={900}
                  className="max-w-full max-h-full object-contain relative z-0 transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://placehold.co/600x600/0f172a/94a3b8.png?text=${encodeURIComponent(displayName)}`;
                  }}
                />

                <div className="absolute top-4 left-4 z-20">
                  {product.stock_status === 'out_of_stock' ? (
                    <span className="bg-background text-muted-foreground border border-border text-[10px] font-semibold tracking-wider px-3 py-1.5 rounded-full shadow-lg">
                      OUT OF STOCK
                    </span>
                  ) : product.stock_status === 'low_stock' ? (
                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-semibold tracking-wider px-3 py-1.5 rounded-full shadow-lg">
                      LOW STOCK
                    </span>
                  ) : product.stock_status === 'backorder' ? (
                    <span className="bg-muted text-muted-foreground border border-border text-[10px] font-semibold tracking-wider px-3 py-1.5 rounded-full shadow-lg">
                      BACKORDER
                    </span>
                  ) : (
                    <span className="bg-primary/15 text-primary border border-primary/30 text-[10px] font-semibold tracking-wider px-3 py-1.5 rounded-full shadow-lg shadow-primary/5">
                      IN STOCK
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {productImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-muted/30 border p-2 flex-shrink-0 transition-all duration-300 ${
                      selectedImage === index 
                        ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(59,130,246,0.2)] scale-105' 
                         : 'border-border hover:border-border/80 hover:scale-102'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${displayName} view ${index + 1}`}
                      width={160}
                      height={160}
                      className="w-full h-full object-cover rounded-lg opacity-80 hover:opacity-100 transition-opacity"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://placehold.co/150x150/0f172a/94a3b8.png?text=View+${index + 1}`;
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground font-tech leading-none mb-3">
                {displayName}
              </h1>

              <div className="flex flex-wrap items-center gap-6 mb-6 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {product.model_number && (
                  <span>Model: <span className="text-foreground/90">{product.model_number}</span></span>
                )}
                {skuValue && (
                  <span>SKU: <span className="text-foreground/90">{skuValue}</span></span>
                )}
                {Number(product.reviewCount) > 0 && Number(product.rating) > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRating rating={product.rating} size="sm" />
                    <span className="text-[10px]">({product.reviewCount} {Number(product.reviewCount) === 1 ? 'review' : 'reviews'})</span>
                  </div>
                )}
              </div>

              <div className="bg-card/45 border border-border/80 rounded-2xl p-8 mb-8 backdrop-blur-md shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                {pricing && (
                  <div className="flex flex-wrap items-baseline gap-4 mb-3 relative z-10">
                    <span className="text-5xl font-black text-foreground font-tech tracking-tight">₹{pricing.salePrice.toLocaleString('en-IN')}</span>
                    {pricing.hasDiscount && (
                      <>
                        <span className="text-xl text-muted-foreground line-through font-light">₹{pricing.mrp.toLocaleString('en-IN')}</span>
                        {pricing.percentageOff > 0 && (
                          <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-wider">
                            {pricing.percentageOff}% OFF
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/60 font-mono relative z-10">PRICE INCLUSIVE OF GST. INSTALLATION & CABLING CHARGED ON ACTUALS.</p>
              </div>

              <div className="prose prose-invert prose-sm mb-8 text-muted-foreground">
                <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} className="leading-relaxed" />
                {highlightSpecs.length > 0 && (
                  <ul className="list-none pl-0 space-y-2 mt-6">
                    {highlightSpecs.map(([key, value]) => (
                      <li key={key} className="flex items-center gap-3 text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                        <span className="text-muted-foreground/80 font-mono uppercase text-xs">{key}:</span>
                        <span className="text-foreground/90 font-medium">{value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex flex-wrap gap-4">
                  <AddToCartButton
                    product={product}
                    className="flex-1 min-w-[220px] h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide uppercase rounded-xl transition-all duration-300 hover:scale-[1.02] shadow-[0_0_30px_-5px_rgba(var(--primary),0.45)] border border-primary/20 cursor-pointer"
                    size="lg"
                  />
                  <WishlistButton
                    product={product}
                    className="h-14 w-14 flex-shrink-0 border border-border bg-muted/30 hover:bg-muted/60 hover:border-border/80 text-foreground rounded-xl transition-all duration-300 cursor-pointer"
                  />
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-14 w-14 flex-shrink-0 border border-border bg-muted/30 hover:bg-muted/60 hover:border-border/80 text-foreground rounded-xl transition-all duration-300 cursor-pointer"
                    onClick={handleShare}
                    aria-label={`Share ${displayName}`}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 border border-border bg-muted/20 hover:bg-muted/40 hover:border-border/80 text-muted-foreground hover:text-foreground rounded-xl transition-all duration-300 cursor-pointer"
                    onClick={() => trackEvent('amc_inquiry', { productId: product.id, productName: displayName })}
                  >
                    <Shield className="mr-2 h-4 w-4 text-primary" />
                    Request AMC Quote
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 border border-border bg-muted/20 hover:bg-muted/40 hover:border-border/80 text-muted-foreground hover:text-foreground rounded-xl transition-all duration-300 cursor-pointer"
                    onClick={() => trackEvent('installation_inquiry', { productId: product.id, productName: displayName })}
                  >
                    <Truck className="mr-2 h-4 w-4 text-primary" />
                    Installation Inquiry
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground/60">
                  <Shield className="inline-block h-3.5 w-3.5 mr-1 text-primary" />
                  {product.warranty ? `${product.warranty} included.` : '2-Year Manufacturer Warranty included.'}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-16 border border-border/80 bg-muted/10 rounded-3xl backdrop-blur-sm">
            <div className="px-6 py-10 sm:px-8">
              <div className="flex gap-8 border-b border-border/80 mb-8 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveTab('specs')}
                  className={`px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all duration-300 cursor-pointer ${
                    activeTab === 'specs'
                      ? 'border-primary text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Specifications
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('description')}
                  className={`px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all duration-300 cursor-pointer ${
                    activeTab === 'description'
                      ? 'border-primary text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Description
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('warranty')}
                  className={`px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all duration-300 cursor-pointer ${
                    activeTab === 'warranty'
                      ? 'border-primary text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Warranty Info
                </button>
              </div>

              {activeTab === 'specs' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 text-sm font-mono">
                  {product.specifications && Object.keys(product.specifications).length > 0 ? (
                    Object.entries(product.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-4 border-b border-border/60">
                        <span className="text-muted-foreground/80 uppercase text-xs">{key}</span>
                        <span className="text-foreground/90 text-right font-medium">{value}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground/80 italic">Specifications will be updated soon.</div>
                  )}
                </div>
              )}

              {activeTab === 'description' && (
                <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed">
                  <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
                </div>
              )}

              {activeTab === 'warranty' && (
                <div className="rounded-2xl border border-border bg-muted/10 p-6 text-sm text-muted-foreground space-y-4 max-w-2xl backdrop-blur-sm">
                  <p className="leading-relaxed">
                    {product.warranty
                      ? `${product.warranty} coverage provided by manufacturer.`
                      : '2-Year Manufacturer Warranty included with standard purchase.'}
                  </p>
                  <div className="flex items-center gap-3 text-muted-foreground/80">
                    <RefreshCw className="h-4 w-4 text-primary animate-spin-slow" />
                    <span>Hassle-free replacement for eligible defects.</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground/80">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Support available via Tecbunny SLA desk.</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 2. BEHAVIORAL CRO ASSISTANCE BANNER */}
      {showAssistance && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-muted/95 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <RefreshCw className="h-5 w-5 animate-spin-slow" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white">Need a custom surveillance blueprint?</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {triggerContext === 'pricing' 
                    ? "Our experts can help optimize this configuration for your specific space and budget requirements."
                    : "Architecture can be complex. Let's schedule a 10-minute discovery call to finalize your setup."}
                </p>
                <div className="mt-4 flex gap-3">
                  <Button 
                    size="sm" 
                    className="h-8 bg-primary hover:bg-primary/90 text-white text-[10px]"
                    onClick={() => router.push('/contact?ref=behavioral_assistance')}
                  >
                    Speak to Specialist
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-[10px] text-muted-foreground hover:text-muted-foreground"
                    onClick={dismissAssistance}
                  >
                    Maybe later
                  </Button>
                </div>
              </div>
            </div>
            {/* Ambient Background Glow */}
            <div className="absolute -bottom-10 -left-10 h-32 w-32 bg-primary/5 blur-[80px]" />
          </div>
        </div>
      )}
    </div>
  );
}
