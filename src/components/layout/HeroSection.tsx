
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { ArrowRight } from 'lucide-react';

import { logger } from '@/lib/logger';

import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

export function HeroSection() {
  const [featuredProduct, setFeaturedProduct] = React.useState<Product | null>(null);
  const [heroSettings, setHeroSettings] = React.useState({
    heroTitle: 'Future at Your Fingertips',
    heroSubtitle: 'Discover the latest in cutting-edge technology. From smart devices to essential gear, find everything you need to stay ahead.',
    heroButtonText: 'Shop All Products',
    heroButtonLink: '/products',
    featuredProductId: '',
  });
  const supabase = createClient();
  
  React.useEffect(() => {
    const fetchHeroSettings = async () => {
      try {
        const { data: settings, error } = await supabase
          .from('settings')
          .select('*')
          .in('key', ['heroTitle', 'heroSubtitle', 'heroButtonText', 'heroButtonLink', 'featuredProductId']);
        
        if (error) {
          logger.warn("Unable to fetch hero settings:", { error: error.message });
        } else {
          const settingsMap = new Map(settings.map(s => [s.key, s.value]));
          setHeroSettings({
            heroTitle: settingsMap.get('heroTitle') || 'Future at Your Fingertips',
            heroSubtitle: settingsMap.get('heroSubtitle') || 'Discover the latest in cutting-edge technology. From smart devices to essential gear, find everything you need to stay ahead.',
            heroButtonText: settingsMap.get('heroButtonText') || 'Shop All Products',
            heroButtonLink: settingsMap.get('heroButtonLink') || '/products',
            featuredProductId: settingsMap.get('featuredProductId') || '',
          });
        }
      } catch (err) {
        logger.warn("Hero settings fetch failed, using defaults", { error: err });
      }
    };

    const fetchFeaturedProduct = async () => {
      try {
        let query = supabase.from('products').select('*');
        
        // If we have a specific featured product ID (and it's not "none"), use it
        if (heroSettings.featuredProductId && heroSettings.featuredProductId !== 'none') {
          query = query.eq('id', heroSettings.featuredProductId);
        } else {
          // Otherwise, get most popular product
          query = query.order('popularity', { ascending: false }).limit(1);
        }
        
        const { data, error } = await query.single();
        
        if (error) {
          logger.warn("Unable to fetch featured product (using fallback):", { error: error.message });
          setFeaturedProduct(null);
        } else {
          const resolvedTitle = [data?.title, data?.name]
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .find((value) => value.length > 0) || 'Product';

          setFeaturedProduct({
            ...data,
            title: resolvedTitle,
            name: resolvedTitle,
          });
        }
      } catch (err) {
        logger.warn("Featured product fetch failed, using fallback content", { error: err });
        setFeaturedProduct(null);
      }
    };
    
    fetchHeroSettings();
    fetchFeaturedProduct();
  }, [supabase, heroSettings.featuredProductId]);


  return (
    <div className="bg-secondary text-secondary-foreground rounded-lg my-8">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary leading-tight">
              {heroSettings.heroTitle}
            </h1>
            <p className="text-lg md:text-xl text-secondary-foreground/80">
              {heroSettings.heroSubtitle}
            </p>
            <div className="flex gap-4 justify-center md:justify-start">
              <Button size="lg" asChild>
                <Link href={heroSettings.heroButtonLink}>
                  {heroSettings.heroButtonText} <ArrowRight className="ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/?section=deals">
                  View Deals
                </Link>
              </Button>
            </div>
          </div>
          
          {featuredProduct && (() => {
            const resolvedName = featuredProduct.title || featuredProduct.name || 'Product';
            const primaryImage = featuredProduct.image || (Array.isArray((featuredProduct as any).images) && (featuredProduct as any).images.length > 0
              ? (typeof (featuredProduct as any).images[0] === 'string' ? (featuredProduct as any).images[0] : (featuredProduct as any).images[0]?.url || '')
              : '');

            return (
              <Link href={`/products/${featuredProduct.id}`} className="group block">
                <div className="relative aspect-square w-full max-w-md mx-auto rounded-lg overflow-hidden transition-all duration-300 group-hover:shadow-2xl group-hover:scale-105">
                  {primaryImage ? (
                    <Image
                      src={primaryImage as string}
                      alt={resolvedName}
                      fill
                      sizes="(max-width: 768px) 80vw, 40vw"
                      className="object-cover"
                      data-ai-hint="smartwatch product"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-6xl font-bold">
                      {resolvedName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <p className="font-semibold text-lg">{resolvedName}</p>
                    <p className="text-2xl font-bold">₹{featuredProduct.price.toFixed(2)}</p>
                  </div>
                </div>
              </Link>
            );
          })()}

        </div>
      </div>
    </div>
  );
}