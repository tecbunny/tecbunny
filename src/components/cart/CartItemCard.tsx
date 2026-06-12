'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '@/lib/hooks';
import { formatCurrency } from '@/lib/utils';
import type { CartItem } from '@/lib/types';

import { BRAND_LOGO_URL } from '@/components/ui/logo';

interface CartItemCardProps {
  item: CartItem;
}

export function CartItemCard({ item }: CartItemCardProps) {
  const { updateQuantity, removeFromCart } = useCart();
  const candidateImages: string[] = [];
  if (typeof item.image === 'string') {
    const trimmed = item.image.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          for (const img of parsed) {
            if (typeof img === 'string') {
              candidateImages.push(img);
            }
          }
        }
      } catch {
        candidateImages.push(trimmed);
      }
    } else {
      candidateImages.push(trimmed);
    }
  }
  if (Array.isArray(item.images)) {
    for (const img of item.images) {
      if (typeof img === 'string') {
        candidateImages.push(img);
      }
    }
  }

  const cleanSrc = candidateImages.find((src) => typeof src === 'string' && src.trim().length > 0);
  const imageSrc = cleanSrc ? cleanSrc.trim() : BRAND_LOGO_URL;
  const fallbackProductUrl = item.id?.startsWith('service-') ? '/services' : `/products/${item.id}`;
  const productHref = typeof item.product_url === 'string' && item.product_url.length > 0
    ? item.product_url
    : fallbackProductUrl;

  const handleQuantityChange = (newQuantity: number) => {
    const clamped = Math.max(1, newQuantity);
    updateQuantity(item.id, clamped);
  };

  const isServiceItem = item.product_type === 'service' || item.id?.startsWith('service-') || item.id?.startsWith('pricing-');
  const unitPrice = item.price;

  return (
    <div
      className={`p-2.5 rounded-md flex flex-col sm:flex-row items-center gap-3 group transition-colors border border-white/10 bg-white/5 ${
        isServiceItem
          ? 'border-l-2 border-primary bg-primary/10'
          : 'hover:border-primary/30'
      }`}
    >
      <div className="w-full sm:w-16 h-16 bg-white/10 rounded-md flex items-center justify-center relative overflow-hidden p-1">
        <Image
          src={imageSrc}
          alt={item.name}
          fill
          sizes="96px"
          unoptimized
          className="object-contain"
        />
      </div>
      <div className="flex-1 text-center sm:text-left space-y-1">
        <Link href={productHref} className="text-white font-semibold text-sm leading-snug hover:text-primary transition-colors line-clamp-2">
          {item.name || 'Service Request'}
        </Link>
        <p className="inline-flex items-center gap-1 text-[10px] text-slate-200 bg-white/10 px-2 py-[4px] rounded-full">
          {item.category || 'Tecbunny Essentials'}
        </p>
        {!isServiceItem && typeof item.mrp === 'number' && item.mrp > unitPrice ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 line-through">{formatCurrency(item.mrp)}</span>
            <span className="text-primary font-semibold text-sm">{formatCurrency(unitPrice)}</span>
          </div>
        ) : (
          <span className="block text-primary font-semibold text-sm">{formatCurrency(unitPrice)}</span>
        )}
        {isServiceItem && (
          <span className="mt-0.5 inline-flex text-[9px] uppercase font-bold text-slate-200 bg-primary/15 px-1.5 py-[3px] rounded">
            Service Item
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center border border-white/10 rounded-md">
          <button
            type="button"
            className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={() => handleQuantityChange(item.quantity - 1)}
            disabled={isServiceItem}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            value={item.quantity}
            readOnly
            min={1}
            aria-label={`Quantity for ${item.name}`}
            className="w-10 h-9 bg-transparent text-center text-white text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          />
          <button
            type="button"
            className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={() => handleQuantityChange(item.quantity + 1)}
            disabled={isServiceItem}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          className="min-h-9 min-w-9 px-2 text-slate-200 hover:text-red-400 active:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          onClick={() => removeFromCart(item.id)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove item</span>
        </button>
      </div>
    </div>
  );
}