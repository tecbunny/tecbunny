'use client';

import * as React from 'react';
import { Star, StarHalf } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  className?: string;
  size?: number | 'sm' | 'md' | 'lg';
}

export function StarRating({ rating, maxRating = 5, className, size = 'md' }: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5 ? 1 : 0;
  const emptyStars = maxRating - fullStars - halfStar;

  const getSize = (size: number | 'sm' | 'md' | 'lg'): number => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'sm': return 14;
      case 'md': return 16;
      case 'lg': return 20;
      default: return 16;
    }
  };

  const starSize = getSize(size);

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full_${i}`} className="text-yellow-400 fill-yellow-400" style={{ width: starSize, height: starSize }} />
      ))}
      {halfStar === 1 && <StarHalf className="text-yellow-400 fill-yellow-400" style={{ width: starSize, height: starSize }} />}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty_${i}`} className="text-yellow-400" style={{ width: starSize, height: starSize }} />
      ))}
    </div>
  );
}