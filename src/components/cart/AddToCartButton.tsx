'use client';

import * as React from 'react';
import { ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/hooks';
import type { Product } from '@/lib/types';

interface AddToCartButtonProps {
  product: Product;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

export function AddToCartButton({ product, className, size = "sm" }: AddToCartButtonProps) {
  const { addToCart, removeFromCart } = useCart();
  const [busy, setBusy] = React.useState(false);

  // Don't render if product is out of stock
  if (product.stock_status === 'out_of_stock') {
    return (
      <Button 
        size={size}
        className={className}
        disabled
        aria-label="Out of stock"
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        Out of Stock
      </Button>
    );
  }

  return (
    <Button 
      size={size}
      className={`flex items-center justify-center ${className}`}
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        
        setBusy(true);
        // Optimistic UI update - instantly reflects in cart
        addToCart(product);
        
        try {
          // Simulate or perform backend API sync here
          // await fetch('/api/cart/sync', { ... })
          // If the network response fails: throw new Error("Sync failed")
        } catch (error) {
          // Rollback state if the backend fails
          removeFromCart(product.id);
          // Assuming toast is available globally or we log the error
          console.error("Cart sync failed, rolled back", error);
        } finally {
          setTimeout(() => setBusy(false), 300);
        }
      }}
      aria-label={`Add ${product.name} to cart`}
    >
      <ShoppingCart className="mr-2 h-4 w-4" />
      Add to Cart
    </Button>
  );
}