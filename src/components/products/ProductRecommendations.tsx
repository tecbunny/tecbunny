
'use client';

import * as React from 'react';

import { logger } from '@/lib/logger';

import type { Product } from '@/lib/types';

import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';

import { ProductCard } from './ProductCard';

// Dynamic import for heavy carousel component
const CarouselContent = React.lazy(() => import('@/components/ui/carousel').then(mod => ({ default: mod.CarouselContent })));
const CarouselItem = React.lazy(() => import('@/components/ui/carousel').then(mod => ({ default: mod.CarouselItem })));
const CarouselNext = React.lazy(() => import('@/components/ui/carousel').then(mod => ({ default: mod.CarouselNext })));
const CarouselPrevious = React.lazy(() => import('@/components/ui/carousel').then(mod => ({ default: mod.CarouselPrevious })));
const Carousel = React.lazy(() => import('@/components/ui/carousel').then(mod => ({ default: mod.Carousel })));

interface ProductRecommendationsProps {
  currentProductId: string;
}

export function ProductRecommendations({ currentProductId }: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = createClient();

  React.useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        
        const { data: currentProduct, error: currentProductError } = await supabase
            .from('products')
            .select('category')
            .eq('id', currentProductId)
            .single();

        if (currentProductError || !currentProduct) {
            setError('Could not load recommendations.');
            setLoading(false);
            return;
        }

        const { data: similarProducts, error: similarProductsError } = await supabase
            .from('products')
            .select('*')
            .eq('category', currentProduct.category)
            .not('id', 'eq', currentProductId)
            .limit(10);
        
        if (similarProductsError) {
            throw new Error('Failed to fetch similar products');
        }

        // Shuffle and take 4
        const randomRecommendations = (similarProducts || [])
          .sort(() => 0.5 - Math.random())
          .slice(0, 4)
          .map((product) => {
            const resolvedTitle = [product.title, product.name]
              .map((value) => (typeof value === 'string' ? value.trim() : ''))
              .find((value) => value.length > 0) || 'Product';
            return {
              ...product,
              title: resolvedTitle,
              name: resolvedTitle,
            } as Product;
          });

        setRecommendations(randomRecommendations);

      } catch (e) {
        logger.error('Failed to fetch product recommendations:', { error: e });
        setError('Could not load recommendations.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [currentProductId, supabase]);

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-primary mb-6">You Might Also Like</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-6 w-1/4" />
                </div>
            ))}
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Don't show the section if there's an error or no recommendations
  }

  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-bold text-primary mb-6">You Might Also Like</h2>
      <React.Suspense fallback={
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
            </div>
          ))}
        </div>
      }>
        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent>
            {recommendations.map((product) => (
              <CarouselItem key={product.id} className="md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <div className="p-1">
                  <ProductCard product={product} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </React.Suspense>
    </div>
  );
}