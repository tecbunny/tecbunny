'use client';

import * as React from 'react';
import { Heart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useWishlist } from '@/lib/hooks';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  product: Product;
  className?: string;
}

export function WishlistButton({ product, className }: WishlistButtonProps) {
  const { toggleWishlist, isInWishlist, isHydrated } = useWishlist();
  const [busy, setBusy] = React.useState(false);

  const isWishlisted = isHydrated && isInWishlist(product.id);

  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn(
        'rounded-full h-9 w-9 bg-background/80 hover:bg-background transition-colors backdrop-blur-sm',
        isWishlisted ? 'text-red-500' : 'text-foreground',
        className
      )}
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          toggleWishlist(product);
        } finally {
          setTimeout(() => setBusy(false), 250);
        }
      }}
      aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
    >
      <Heart className={cn('h-5 w-5', isWishlisted && 'fill-current')} />
    </Button>
  );
}