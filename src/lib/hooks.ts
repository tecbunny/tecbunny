'use client';

import { useContext, useEffect, useCallback, useMemo } from 'react';

import { AuthContext } from '../context/AuthProvider';
import { useWishlistStore } from '../store/wishlistStore';
import { useCartStore } from '../store/cartStore';
import { useAnalytics } from '../hooks/use-analytics';

export const useWishlist = () => {
  const store = useWishlistStore();
  
  // Return the same interface as the old WishlistContext
  return {
    wishlistItems: store.wishlistItems,
    toggleWishlist: store.toggleWishlist,
    isInWishlist: store.isInWishlist,
    wishlistCount: store.wishlistCount,
  };
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useCart = () => {
  const store = useCartStore();
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();

  // Run initialization logic exactly once or when user changes
  useEffect(() => {
    store.loadCartFromStorage(user);
  }, [user, store.loadCartFromStorage]);

  useEffect(() => {
    store.checkSessionExpiry(user);
    const interval = setInterval(() => store.checkSessionExpiry(user), 60 * 1000);
    return () => clearInterval(interval);
  }, [user, store.isHydrated, store.checkSessionExpiry]);

  useEffect(() => {
    if (store.isHydrated && !store.isSessionExpired) {
      store.saveCartToStorage(user);
      if (store.cartItems.length > 0) {
        store.refreshPricing(undefined, user);
      } else if (store.pricing.appliedCoupon) {
        store.refreshPricing(null, user);
      }
    }
  }, [store.cartItems, store.isHydrated, store.isSessionExpired, store.pricing.appliedCoupon, user, store.saveCartToStorage, store.refreshPricing]);

  useEffect(() => {
    store.checkAbandonedCart(user);
    const interval = setInterval(() => store.checkAbandonedCart(user), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [store.cartItems, store.isHydrated, user, store.isSessionExpired, store.checkAbandonedCart]);

  // Bind actions to user and trackEvent
  const addToCart = useCallback((item: any, quantity?: number) => {
    store.addToCart(item, quantity || 1, user, trackEvent);
  }, [store, user, trackEvent]);

  const removeFromCart = useCallback((itemId: string) => {
    store.removeFromCart(itemId, user, trackEvent);
  }, [store, user, trackEvent]);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    store.updateQuantity(itemId, quantity, user);
  }, [store, user]);

  const clearCart = useCallback(() => {
    store.clearCart(user);
  }, [store, user]);

  const applyCoupon = useCallback((coupon: any) => {
    return store.applyCoupon(coupon, user);
  }, [store, user]);

  const removeCoupon = useCallback(() => {
    store.removeCoupon(user);
  }, [store, user]);

  const refreshPricing = useCallback((currentAppliedCoupon?: any) => {
    return store.refreshPricing(currentAppliedCoupon, user);
  }, [store, user]);

  // Compute legacy values
  const cartCount = useMemo(() => store.cartItems.reduce((count, item) => count + item.quantity, 0), [store.cartItems]);
  const cartTotal = useMemo(() => store.cartItems.reduce((total, item) => total + item.price * item.quantity, 0), [store.cartItems]);
  const cartSubtotal = useMemo(() => store.cartItems.reduce((total, item) => {
    const price = item.price;
    const gstRate = typeof item.gstRate === 'number' ? item.gstRate : 18;
    const basePrice = price / (1 + (gstRate / 100));
    return total + basePrice * item.quantity;
  }, 0), [store.cartItems]);
  const cartGst = cartTotal - cartSubtotal;

  return {
    cartItems: store.cartItems,
    pricing: store.pricing,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    applyCoupon,
    removeCoupon,
    refreshPricing,
    cartCount,
    cartSubtotal,
    cartGst,
    cartTotal,
    isSessionExpired: store.isSessionExpired,
    resetGuestSession: store.resetGuestSession,
  };
};
