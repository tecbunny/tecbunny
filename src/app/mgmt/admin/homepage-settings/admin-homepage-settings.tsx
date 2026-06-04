
'use client';

import * as React from 'react';

import Image from 'next/image';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { getProductDisplayImage } from '@/lib/image-utils';
import { useToast } from '../../../../hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ProductSelectorProps {
  title: string;
  description: string;
  allProducts: Product[];
  selectedIds: Set<string>;
  onToggle: (productId: string) => void;
  onAutoFill?: () => void;
  onAutoFillPreview?: () => void;
  maxSelection?: number;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({ title, description, allProducts, selectedIds, onToggle, onAutoFill, onAutoFillPreview, maxSelection = 15 }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
            <CardTitle>{title} <span className="text-sm font-normal text-muted-foreground">({selectedIds.size}/{maxSelection} selected)</span></CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {onAutoFill && (
            <Button size="sm" variant="outline" onClick={onAutoFill}>Auto-fill</Button>
          )}
          {onAutoFillPreview && (
            <Button size="sm" variant="ghost" onClick={onAutoFillPreview}>Preview</Button>
          )}
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <ScrollArea className="h-96 pr-4">
        <div className="space-y-4">
          {allProducts.map(product => (
            <div key={product.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-4">
                {getProductDisplayImage(product) ? (
                  <Image 
                    src={getProductDisplayImage(product)!}
                    alt={product.name}
                    width={48}
                    height={48}
                    className="rounded-md object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                    {product.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.category}</p>
                </div>
              </div>
              <Checkbox
                checked={selectedIds.has(product.id)}
                onCheckedChange={() => onToggle(product.id)}
                aria-label={`Select ${product.name}`}                
                disabled={!selectedIds.has(product.id) && selectedIds.size >= (maxSelection ?? 15)}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
);


export default function HomepageSettingsPage() {
  const { toast } = useToast();
  const supabase = createClient();
  const [allProducts, setAllProducts] = React.useState<Product[]>([]);
  
  const [featuredProductIds, setFeaturedProductIds] = React.useState<Set<string>>(new Set());
  const [newArrivalProductIds, setNewArrivalProductIds] = React.useState<Set<string>>(new Set());
  const [trendingProductIds, setTrendingProductIds] = React.useState<Set<string>>(new Set());
  const [dealProductIds, setDealProductIds] = React.useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<{ featured: Product[]; newArrivals: Product[]; trending: Product[]; deals: Product[] } | null>(null);

  const MAX_SELECTION = 15;

  const normalizeSettingsRows = React.useCallback((payload: unknown): Array<{ key: string; value: string }> => {
    if (Array.isArray(payload)) {
      return payload.filter(
        (item): item is { key: string; value: string } =>
          typeof item?.key === 'string' && typeof item?.value === 'string'
      );
    }

    if (payload && typeof payload === 'object') {
      return Object.entries(payload as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value ?? null),
      }));
    }

    return [];
  }, []);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const productsController = new AbortController();
        const productsTimeout = window.setTimeout(() => productsController.abort(), 12000);

        const productsResponse = await fetch('/api/admin/products?includeInactive=true&limit=250', {
          cache: 'no-store',
          signal: productsController.signal,
        });
        window.clearTimeout(productsTimeout);

        const productsPayload = await productsResponse.json().catch(() => null);
        const products = Array.isArray(productsPayload?.products) ? productsPayload.products : [];

        const normalizedProducts = (products || []).map((product: any) => {
          const resolvedTitle = [product.title, product.name]
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .find((value) => value.length > 0) || 'Product';
          return {
            ...product,
            title: resolvedTitle,
            name: resolvedTitle,
          } as Product;
        });
        setAllProducts(normalizedProducts);

        let settingsRows: Array<{ key: string; value: string }> = [];

        const settingsResponse = await fetch('/api/settings', {
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        const settingsPayload = await settingsResponse.json().catch(() => null);
        if (settingsResponse.ok) {
          settingsRows = normalizeSettingsRows(settingsPayload);
        } else {
          const { data: fallbackSettings } = await supabase.from('settings').select('*');
          settingsRows = (fallbackSettings || []) as Array<{ key: string; value: string }>;
        }

        const settingsMap = new Map(settingsRows?.map((s) => [s.key, s.value]));

        const loadIds = (key: string): Set<string> => {
          const storedIds = settingsMap.get(key);
          if (!storedIds) return new Set();
          try {
            return new Set(JSON.parse(storedIds));
          } catch {
            return new Set();
          }
        };

        setFeaturedProductIds(loadIds('featuredProductIds'));
        setNewArrivalProductIds(loadIds('newArrivalProductIds'));
        setTrendingProductIds(loadIds('trendingProductIds'));
        setDealProductIds(loadIds('dealProductIds'));
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to load homepage data',
          description: error instanceof Error ? error.message : 'Please try again later.',
        });
      }
    };
    fetchData();
  }, [normalizeSettingsRows, supabase, toast]);

  const createToggleHandler = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (productId: string) => {
    setter(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        if (newSet.size >= MAX_SELECTION) {
          toast({ variant: 'destructive', title: `Cannot select more than ${MAX_SELECTION} items.` });
          return prev;
        }
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const autoFillSelector = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, products: Product[]) => {
    const newSet = new Set<string>(products.slice(0, MAX_SELECTION).map(p => p.id));
    setter(newSet);
  };

  const handleSaveChanges = async () => {
    try {
      // Validate counts
      if (featuredProductIds.size > MAX_SELECTION || newArrivalProductIds.size > MAX_SELECTION || trendingProductIds.size > MAX_SELECTION || dealProductIds.size > MAX_SELECTION) {
        toast({ variant: 'destructive', title: `Please select at most ${MAX_SELECTION} products per section.` });
        return;
      }
      // Use authenticated API to perform upserts one-by-one to avoid RLS multi-row issues
      const payloads = [
        { key: 'featuredProductIds', value: JSON.stringify(Array.from(featuredProductIds)) },
        { key: 'newArrivalProductIds', value: JSON.stringify(Array.from(newArrivalProductIds)) },
        { key: 'trendingProductIds', value: JSON.stringify(Array.from(trendingProductIds)) },
        { key: 'dealProductIds', value: JSON.stringify(Array.from(dealProductIds)) },
      ];
      for (const p of payloads) {
        const res = await fetch(`/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: p.key, value: p.value })
        });
        if (!res.ok) {
          const data = await res.json().catch(()=>({}));
          throw new Error(data.error || `Failed saving ${p.key}`);
        }
      }
      toast({
        title: 'Settings Saved',
        description: 'Your homepage product selections have been updated.',
      });
    } catch (e:any) {
      toast({
        variant: 'destructive',
        title: 'Error Saving Settings',
        description: e.message || 'Unknown error',
      });
    }
  };

  const previewAutoFill = async (options?: { limit?: number; days?: number }) => {
    try {
      setPreviewOpen(true);
      const res = await fetch('/api/admin/homepage/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: options?.limit ?? MAX_SELECTION, days: options?.days ?? 30 })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to fetch auto-fill');
      setPreviewData({
        featured: json.featured || [],
        newArrivals: json.newArrivals || [],
        trending: json.trending || [],
        deals: json.deals || []
      });
    } catch (e:any) {
      toast({ variant: 'destructive', title: 'Auto-fill Preview failed', description: e?.message || 'Unknown error' });
      setPreviewData(null);
      setPreviewOpen(false);
    }
  };

  const applyPreviewForSection = (section: 'featured' | 'newArrivals' | 'trending' | 'deals') => {
    if (!previewData) return;
    const products = previewData[section] || [];
    const ids = new Set(products.slice(0, MAX_SELECTION).map(p => p.id));
    switch (section) {
      case 'featured': setFeaturedProductIds(ids); break;
      case 'newArrivals': setNewArrivalProductIds(ids); break;
      case 'trending': setTrendingProductIds(ids); break;
      case 'deals': setDealProductIds(ids); break;
    }
    toast({ title: `${section} auto-fill applied`, description: `Applied ${Math.min(ids.size, MAX_SELECTION)} items.` });
  };

  const applyPreviewForAll = () => {
    if (!previewData) return;
    setFeaturedProductIds(new Set(previewData.featured.slice(0, MAX_SELECTION).map(p => p.id)));
    setNewArrivalProductIds(new Set(previewData.newArrivals.slice(0, MAX_SELECTION).map(p => p.id)));
    setTrendingProductIds(new Set(previewData.trending.slice(0, MAX_SELECTION).map(p => p.id)));
    setDealProductIds(new Set(previewData.deals.slice(0, MAX_SELECTION).map(p => p.id)));
    toast({ title: 'Auto-fill applied to all sections', description: `Applied up to ${MAX_SELECTION} items per section.` });
  };

  const computeFeaturedDefaults = (products: Product[]) => {
    return [...products].sort((a, b) => {
      const aP = a.prioritized ? 1 : 0;
      const bP = b.prioritized ? 1 : 0;
      if (aP !== bP) return bP - aP;
      if ((a.popularity || 0) !== (b.popularity || 0)) return (b.popularity || 0) - (a.popularity || 0);
      if ((a.rating || 0) !== (b.rating || 0)) return (b.rating || 0) - (a.rating || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }).slice(0, MAX_SELECTION);
  };

  const computeNewArrivalsDefaults = (products: Product[]) => {
    return [...products].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, MAX_SELECTION);
  };

  const computeTrendingDefaults = (products: Product[]) => {
    return [...products].sort((a, b) => {
      const aScore = (a.popularity || 0) * 0.6 + (a.rating || 0) * 0.3 + ((a.reviewCount || 0) * 0.1);
      const bScore = (b.popularity || 0) * 0.6 + (b.rating || 0) * 0.3 + ((b.reviewCount || 0) * 0.1);
      return bScore - aScore;
    }).slice(0, MAX_SELECTION);
  };

  const computeDealsDefaults = (products: Product[]) => {
    return [...products]
      .filter(p => (typeof p.offer_price === 'number' && p.offer_price < p.price) || (p.discount_percentage && p.discount_percentage > 0))
      .sort((a, b) => {
        const aDiscount = (a.price || 0) - (a.offer_price || a.price || 0);
        const bDiscount = (b.price || 0) - (b.offer_price || b.price || 0);
        if (bDiscount !== aDiscount) return bDiscount - aDiscount;
        return (b.popularity || 0) - (a.popularity || 0);
      })
      .slice(0, MAX_SELECTION);
  };


  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold">Homepage Settings</h1>
            <p className="text-muted-foreground">
              Control the content and layout of your store's homepage.
            </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => {
            autoFillSelector(setFeaturedProductIds, computeFeaturedDefaults(allProducts));
            autoFillSelector(setNewArrivalProductIds, computeNewArrivalsDefaults(allProducts));
            autoFillSelector(setTrendingProductIds, computeTrendingDefaults(allProducts));
            autoFillSelector(setDealProductIds, computeDealsDefaults(allProducts));
            toast({ title: 'Auto-filled all sections with analytics defaults' });
          }} size="lg" variant="outline">Auto-fill All</Button>
          <Button onClick={handleSaveChanges} size="lg">Save All Changes</Button>
        </div>
      </div>
     
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ProductSelector
          title="Featured Products"
          description="Select products to feature prominently on the homepage."
          allProducts={allProducts}
          selectedIds={featuredProductIds}
          onToggle={createToggleHandler(setFeaturedProductIds)}
          onAutoFill={() => autoFillSelector(setFeaturedProductIds, computeFeaturedDefaults(allProducts))}
          onAutoFillPreview={() => previewAutoFill()}
          maxSelection={MAX_SELECTION}
        />
         <ProductSelector
          title="New Arrivals"
          description="Choose the products to display in the 'New Arrivals' section."
          allProducts={allProducts}
          selectedIds={newArrivalProductIds}
          onToggle={createToggleHandler(setNewArrivalProductIds)}
          onAutoFill={() => autoFillSelector(setNewArrivalProductIds, computeNewArrivalsDefaults(allProducts))}
          onAutoFillPreview={() => previewAutoFill()}
          maxSelection={MAX_SELECTION}
        />
         <ProductSelector
          title="Trending Products"
          description="Set the products that are currently trending on your store."
          allProducts={allProducts}
          selectedIds={trendingProductIds}
          onToggle={createToggleHandler(setTrendingProductIds)}
          onAutoFill={() => autoFillSelector(setTrendingProductIds, computeTrendingDefaults(allProducts))}
          onAutoFillPreview={() => previewAutoFill()}
          maxSelection={MAX_SELECTION}
        />
         <ProductSelector
          title="Deal Products"
          description="Select products that will be part of special deals."
          allProducts={allProducts}
          selectedIds={dealProductIds}
          onToggle={createToggleHandler(setDealProductIds)}
          onAutoFill={() => autoFillSelector(setDealProductIds, computeDealsDefaults(allProducts))}
          onAutoFillPreview={() => previewAutoFill()}
          maxSelection={MAX_SELECTION}
        />
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto-fill Preview</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {!previewData ? (
              <div>Loading...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold">Featured ({previewData.featured.length})</h3>
                  <ul className="space-y-2 mt-2">
                    {previewData.featured.map(p => (
                      <li key={p.id} className="text-sm">{p.title || p.name}</li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <Button size="sm" onClick={() => applyPreviewForSection('featured')}>Apply Featured</Button>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">New Arrivals ({previewData.newArrivals.length})</h3>
                  <ul className="space-y-2 mt-2">
                    {previewData.newArrivals.map(p => (
                      <li key={p.id} className="text-sm">{p.title || p.name}</li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <Button size="sm" onClick={() => applyPreviewForSection('newArrivals')}>Apply New Arrivals</Button>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Trending ({previewData.trending.length})</h3>
                  <ul className="space-y-2 mt-2">
                    {previewData.trending.map(p => (
                      <li key={p.id} className="text-sm">{p.title || p.name}</li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <Button size="sm" onClick={() => applyPreviewForSection('trending')}>Apply Trending</Button>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Deals ({previewData.deals.length})</h3>
                  <ul className="space-y-2 mt-2">
                    {previewData.deals.map(p => (
                      <li key={p.id} className="text-sm">{p.title || p.name}</li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <Button size="sm" onClick={() => applyPreviewForSection('deals')}>Apply Deals</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button onClick={() => { applyPreviewForAll(); setPreviewOpen(false); }}>Apply All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
