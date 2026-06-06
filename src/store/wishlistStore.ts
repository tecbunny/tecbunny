import { create } from 'zustand';
import type { Product } from '@/lib/types';
import { toast } from '../hooks/use-toast';

export interface WishlistState {
  wishlistItems: Product[];
  wishlistCount: number;
  ownerKey: string;
  toggleWishlist: (item: Product) => void;
  isInWishlist: (itemId: string) => boolean;
  setWishlistOwner: (ownerKey: string) => void;
  clearWishlistMemory: () => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

const getWishlistStorageKey = (ownerKey: string) => `wishlist_${ownerKey || 'guest'}`;

const readWishlist = (ownerKey: string): Product[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getWishlistStorageKey(ownerKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeWishlist = (ownerKey: string, items: Product[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getWishlistStorageKey(ownerKey), JSON.stringify(items));
};

export const useWishlistStore = create<WishlistState>()((set, get) => ({
  wishlistItems: [],
  wishlistCount: 0,
  ownerKey: 'guest',
  _hasHydrated: false,
  setHasHydrated: (state) => {
    set({ _hasHydrated: state });
  },
  setWishlistOwner: (ownerKey) => {
    const nextOwnerKey = ownerKey || 'guest';
    const currentOwnerKey = get().ownerKey;
    if (currentOwnerKey === nextOwnerKey && get()._hasHydrated) return;

    set({ wishlistItems: [], wishlistCount: 0, ownerKey: nextOwnerKey, _hasHydrated: false });
    const items = readWishlist(nextOwnerKey);
    set({ wishlistItems: items, wishlistCount: items.length, _hasHydrated: true });
  },
  clearWishlistMemory: () => {
    if (typeof window !== 'undefined') {
      try {
        const owner = get().ownerKey;
        window.localStorage.removeItem(getWishlistStorageKey(owner));
        window.localStorage.removeItem(getWishlistStorageKey('guest'));
      } catch (e) {}
    }
    set({ wishlistItems: [], wishlistCount: 0, ownerKey: 'guest', _hasHydrated: true });
  },
  toggleWishlist: (item) => {
    const state = get();
    const existingItem = state.wishlistItems.find((wItem) => wItem.id === item.id);
    const itemName = item.name || item.title || 'Product';
    let newItems: Product[];

    if (existingItem) {
      toast({
        title: "Removed from wishlist",
        description: `${itemName} has been removed from your wishlist.`,
      });
      newItems = state.wishlistItems.filter((wItem) => wItem.id !== item.id);
    } else {
      toast({
        title: "Added to wishlist",
        description: `${itemName} has been added to your wishlist.`,
      });
      newItems = [...state.wishlistItems, item];
    }

    writeWishlist(state.ownerKey, newItems);
    set({ wishlistItems: newItems, wishlistCount: newItems.length });
  },
  isInWishlist: (itemId) => {
    return get().wishlistItems.some((item) => item.id === itemId);
  },
}));
