import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/lib/types';
import { toast } from '../hooks/use-toast';

export interface WishlistState {
  wishlistItems: Product[];
  wishlistCount: number;
  toggleWishlist: (item: Product) => void;
  isInWishlist: (itemId: string) => boolean;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlistItems: [],
      wishlistCount: 0,
      _hasHydrated: false,
      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },
      toggleWishlist: (item) => {
        const state = get();
        const existingItem = state.wishlistItems.find((wItem) => wItem.id === item.id);
        if (existingItem) {
          toast({
            title: "Removed from wishlist",
            description: `${item.name} has been removed from your wishlist.`,
          });
          const newItems = state.wishlistItems.filter((wItem) => wItem.id !== item.id);
          set({ wishlistItems: newItems, wishlistCount: newItems.length });
        } else {
          toast({
            title: "Added to wishlist",
            description: `${item.name} has been added to your wishlist.`,
          });
          const newItems = [...state.wishlistItems, item];
          set({ wishlistItems: newItems, wishlistCount: newItems.length });
        }
      },
      isInWishlist: (itemId) => {
        return get().wishlistItems.some((item) => item.id === itemId);
      },
    }),
    {
      name: 'wishlist',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
