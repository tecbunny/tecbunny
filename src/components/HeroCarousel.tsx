'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DOMPurify from 'dompurify';

import { usePageContent } from '../hooks/use-page-content';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';
import type { HeroCarouselContent, HeroCarouselItem, HeroCarouselPageKey } from '../lib/types';
import { cn } from '../lib/utils';

interface HeroCarouselProps {
  pageKey: HeroCarouselPageKey;
  intervalMs?: number;
  className?: string;
}

const PAGE_LABEL: Record<HeroCarouselPageKey, string> = {
  homepage: 'Homepage Hero Carousel',
  services: 'Services Hero Carousel',
  offers: 'Offers Hero Carousel',
  products: 'Products Hero Carousel',
  innovations: 'Innovations Hero Carousel',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureContent(value: unknown): HeroCarouselContent {
  const empty: HeroCarouselContent = {
    homepage: [],
    services: [],
    offers: [],
    products: [],
    innovations: [],
  };
  if (!isRecord(value)) {
    return empty;
  }
  const rawPages = isRecord(value.pages) ? value.pages : value;
  return {
    homepage: normalizeSlides('homepage', rawPages.homepage),
    services: normalizeSlides('services', rawPages.services),
    offers: normalizeSlides('offers', rawPages.offers),
    products: normalizeSlides('products', rawPages.products),
    innovations: normalizeSlides('innovations', rawPages.innovations),
  };
}

function normalizeSlides(pageKey: HeroCarouselPageKey, raw: unknown): HeroCarouselItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item, index) => {
      const fallbackId = `slide-${pageKey}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : fallbackId;
      const imageUrl =
        typeof item.imageUrl === 'string' && item.imageUrl.length > 0
          ? item.imageUrl
          : typeof item.image === 'string' && item.image.length > 0
          ? item.image
          : '';
      return {
        id,
        title: typeof item.title === 'string' ? item.title : '',
        subtitle: typeof item.subtitle === 'string' ? item.subtitle : undefined,
        description: typeof item.description === 'string' ? item.description : undefined,
        htmlContent: typeof item.htmlContent === 'string' ? item.htmlContent : undefined,
        imageUrl,
        ctaText: typeof item.ctaText === 'string' ? item.ctaText : undefined,
        ctaLink: typeof item.ctaLink === 'string' ? item.ctaLink : undefined,
        isActive: item.isActive === false ? false : true,
        displayOrder:
          typeof item.displayOrder === 'number'
            ? item.displayOrder
            : typeof item.order === 'number'
            ? item.order
            : undefined,
      } satisfies HeroCarouselItem;
    })
    .filter(slide => slide.imageUrl.length > 0)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((slide, order) => ({ ...slide, displayOrder: order }));
}

export default function HeroCarousel({ pageKey, intervalMs = 6000, className }: HeroCarouselProps) {
  const { content, loading } = usePageContent('hero-carousels');
  const prefersReducedMotion = usePrefersReducedMotion();

  const slides = React.useMemo(() => {
    if (!content?.content) {
      return [] as HeroCarouselItem[];
    }
    const carouselContent = ensureContent(content.content);
    return carouselContent[pageKey].filter(slide => slide.isActive !== false);
  }, [content, pageKey]);

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [pageKey, slides.length]);

  React.useEffect(() => {
    if (paused || prefersReducedMotion || slides.length <= 1) {
      return;
    }
    const id = window.setInterval(() => {
      setActiveIndex(prev => (prev + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, paused, prefersReducedMotion, slides.length]);

  if (loading) {
    return (
      <section className={cn('py-6', className)} aria-label={PAGE_LABEL[pageKey]}>
        <div className="container mx-auto px-4">
          <div className="h-48 w-full animate-pulse rounded-2xl bg-muted" />
        </div>
      </section>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  const goTo = (index: number) => {
    setActiveIndex((index + slides.length) % slides.length);
  };

  const currentSlide = slides[activeIndex] ?? slides[0];

  return (
    <section
      className={cn('py-10 sm:py-14', className)}
      aria-label={PAGE_LABEL[pageKey]}
    >
      <div className="container mx-auto px-4">
        <div
          className="relative overflow-hidden rounded-3xl bg-gray-900 text-white shadow-xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="relative h-[340px] sm:h-[420px]">
            {slides.map((slide, index) => (
              <article
                key={slide.id}
                className={cn(
                  'absolute inset-0 transition-opacity duration-700 ease-in-out',
                  index === activeIndex ? 'opacity-100' : 'opacity-0'
                )}
                aria-hidden={index === activeIndex ? undefined : true}
              >
                <Image
                  src={slide.imageUrl}
                  alt={slide.title || 'Hero banner image'}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"
                  priority={index === activeIndex}
                  className="h-full w-full object-cover"
                  onError={event => {
                    const target = event.currentTarget as HTMLImageElement;
                    target.onerror = null;
                    target.src = 'https://placehold.co/1200x600?text=Hero+Banner';
                  }}
                />
                {slide.htmlContent ? (
                  <div
                    className={cn(
                      'carousel-overlay absolute inset-0 flex h-full w-full flex-col justify-center',
                      index === activeIndex ? 'carousel-overlay--active' : ''
                    )}
                    dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(slide.htmlContent) : '' }}
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-black/55" />
                    <div className="absolute inset-0 flex items-center">
                      <div className="px-6 sm:px-12">
                        <div className={cn('carousel-copy max-w-2xl space-y-4', index === activeIndex ? 'carousel-copy--active' : '')}>
                          {slide.subtitle && (
                            <p className="text-sm font-medium uppercase tracking-[0.3em] text-blue-200">
                              {slide.subtitle}
                            </p>
                          )}
                          {slide.title && (
                            <h2 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                              {slide.title}
                            </h2>
                          )}
                          {slide.description && (
                            <p className="text-base text-blue-100 sm:text-lg">
                              {slide.description}
                            </p>
                          )}
                          {slide.ctaText && slide.ctaLink && (
                            <Link
                              href={slide.ctaLink}
                              className="inline-flex items-center rounded-full bg-white px-6 py-2 text-sm font-semibold text-gray-900 shadow-lg transition hover:bg-gray-200"
                            >
                              {slide.ctaText}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>

          {slides.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`Go to slide ${index + 1}`}
                    aria-current={index === activeIndex}
                    onClick={() => goTo(index)}
                    className={cn(
                      'h-2.5 w-2.5 rounded-full transition',
                      index === activeIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                    )}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
        {currentSlide?.title ? (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {slides.length > 1 ? `${currentSlide.title}` : currentSlide.title}
          </div>
        ) : null}
      </div>
    </section>
  );
}
