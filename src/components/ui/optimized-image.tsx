'use client';

import * as React from 'react';
import Image, { type ImageProps } from 'next/image';

import { cn } from '../../lib/utils';

import { logger } from '../../lib/logger';

interface OptimizedImageProps extends Omit<ImageProps, 'src' | 'alt' | 'width' | 'height' | 'fill' | 'quality' | 'placeholder' | 'blurDataURL'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  transformation?: Record<string, unknown>;
  fallbackSrc?: string;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

// Check if the image is from Supabase Storage
const isSupabaseUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('supabase.co/storage') || url.includes('.storage.supabase.co');
};

// Generate Supabase URL with transformations (basic optimization)
const getOptimizedUrl = (
  src: string, 
  transformation?: Record<string, unknown>
): string => {
  if (!src || typeof src !== 'string') return src || '';
  
  // For Supabase URLs, we can add basic query parameters for optimization
  if (isSupabaseUrl(src)) {
    try {
      const url = new URL(src);
      
      // Add basic optimization parameters
      if (transformation?.width) url.searchParams.set('width', transformation.width.toString());
      if (transformation?.height) url.searchParams.set('height', transformation.height.toString());
      if (transformation?.quality) url.searchParams.set('quality', transformation.quality.toString());
      
      return url.toString();
    } catch (error) {
      logger.warn('Failed to parse Supabase URL', { error, src, context: 'OptimizedImage.getOptimizedSrc' });
      return src;
    }
  }
  
  // For other URLs, return as-is
  return src;
};

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  sizes,
  className,
  priority = false,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  transformation,
  fallbackSrc = 'https://placehold.co/600x400.png',
  onError,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = React.useState(src);
  const [hasError, setHasError] = React.useState(false);

  // Reset error state when src changes
  React.useEffect(() => {
    setHasError(false);
    setImgSrc(src);
  }, [src]);

  const handleError = React.useCallback((event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event);

    if (!hasError) {
      logger.warn('Failed to load image', { imgSrc, context: 'OptimizedImage.handleError' });
      setHasError(true);
      const safeFallback = (imgSrc && imgSrc.startsWith('data:image/svg')) ? 'https://placehold.co/600x400.png' : fallbackSrc;
      setImgSrc(safeFallback);
    }
  }, [fallbackSrc, hasError, imgSrc, onError]);

  // Get optimized URL
  const optimizedSrc = React.useMemo(() => {
    if (hasError) return fallbackSrc;
    
    const optimizationParams = {
      ...transformation,
      width: width || transformation?.width,
      height: height || transformation?.height,
      quality,
    };
    
    return getOptimizedUrl(imgSrc, optimizationParams);
  }, [imgSrc, transformation, width, height, quality, hasError, fallbackSrc]);

  const imageProps = {
    src: optimizedSrc,
    className: cn(className),
    priority,
    quality,
    placeholder,
    blurDataURL,
    onError: handleError,
    ...props,
  };

  if (fill) {
    return (
      <Image
        {...imageProps}
        alt={alt}
        fill
        sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
        blurDataURL={blurDataURL || undefined}
      />
    );
  }

  if (width && height) {
    return (
      <Image
        {...imageProps}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        blurDataURL={blurDataURL || undefined}
      />
    );
  }

  // Fallback to fill if no dimensions specified
  return (
    <Image
      {...imageProps}
      alt={alt}
      fill
      sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
      blurDataURL={blurDataURL || undefined}
    />
  );
}
