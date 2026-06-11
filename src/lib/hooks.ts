'use client';

import { useContext, useEffect, useCallback, useMemo } from 'react';

import { AuthContext } from '../context/AuthProvider';
import { useWishlistStore } from '../store/wishlistStore';
import { useCartStore } from '../store/cartStore';
import { useAnalytics } from '../hooks/use-analytics';

export const useWishlist = () => {
  const { wishlistItems, toggleWishlist, isInWishlist, wishlistCount, setWishlistOwner } = useWishlistStore();
  const { user } = useAuth();

  useEffect(() => {
    setWishlistOwner(user?.id ? `user_${user.id}` : 'guest');
  }, [setWishlistOwner, user?.id]);
  
  // Return the same interface as the old WishlistContext
  return {
    wishlistItems,
    toggleWishlist,
    isInWishlist,
    wishlistCount,
    isHydrated: useWishlistStore.getState()._hasHydrated,
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
  const {
    cartItems,
    pricing,
    isSessionExpired,
    isHydrated,
    loadCartFromStorage,
    checkSessionExpiry,
    saveCartToStorage,
    refreshPricing: storeRefreshPricing,
    checkAbandonedCart,
    addToCart: storeAddToCart,
    removeFromCart: storeRemoveFromCart,
    updateQuantity: storeUpdateQuantity,
    clearCart: storeClearCart,
    applyCoupon: storeApplyCoupon,
    removeCoupon: storeRemoveCoupon,
    resetGuestSession,
  } = useCartStore();
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();

  // Run initialization logic exactly once or when user changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageEvent = (e: StorageEvent) => {
      const cartKey = user ? `tecbunny_cart_user_${user.id}` : 'tecbunny_cart_guest';
      if (e.key === cartKey) {
        loadCartFromStorage(user);
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    loadCartFromStorage(user);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [user, loadCartFromStorage]);

  useEffect(() => {
    checkSessionExpiry(user);
    const interval = setInterval(() => checkSessionExpiry(user), 60 * 1000);
    return () => clearInterval(interval);
  }, [user, isHydrated, checkSessionExpiry]);

  useEffect(() => {
    if (isHydrated && !isSessionExpired) {
      saveCartToStorage(user);
      if (cartItems.length > 0) {
        storeRefreshPricing(undefined, user);
      } else if (pricing.appliedCoupon) {
        storeRefreshPricing(null, user);
      }
    }
  }, [cartItems, isHydrated, isSessionExpired, pricing.appliedCoupon, user, saveCartToStorage, storeRefreshPricing]);

  useEffect(() => {
    checkAbandonedCart(user);
    const interval = setInterval(() => checkAbandonedCart(user), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cartItems, isHydrated, user, isSessionExpired, checkAbandonedCart]);

  // Bind actions to user and trackEvent
  const addToCart = useCallback((item: any, quantity?: number) => {
    storeAddToCart(item, quantity || 1, user, trackEvent);
  }, [storeAddToCart, user, trackEvent]);

  const removeFromCart = useCallback((itemId: string) => {
    storeRemoveFromCart(itemId, user, trackEvent);
  }, [storeRemoveFromCart, user, trackEvent]);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    storeUpdateQuantity(itemId, quantity, user);
  }, [storeUpdateQuantity, user]);

  const clearCart = useCallback(() => {
    storeClearCart(user);
  }, [storeClearCart, user]);

  const applyCoupon = useCallback((coupon: any) => {
    return storeApplyCoupon(coupon, user);
  }, [storeApplyCoupon, user]);

  const removeCoupon = useCallback(() => {
    storeRemoveCoupon(user);
  }, [storeRemoveCoupon, user]);

  const refreshPricing = useCallback((currentAppliedCoupon?: any) => {
    return storeRefreshPricing(currentAppliedCoupon, user);
  }, [storeRefreshPricing, user]);

  // Compute legacy values
  const cartCount = useMemo(() => cartItems.reduce((count, item) => count + item.quantity, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((total, item) => total + item.price * item.quantity, 0), [cartItems]);
  const cartSubtotal = useMemo(() => cartItems.reduce((total, item) => {
    const price = item.price;
    const gstRate = typeof item.gstRate === 'number' ? item.gstRate : 18;
    const basePrice = price / (1 + (gstRate / 100));
    return total + basePrice * item.quantity;
  }, 0), [cartItems]);
  const cartGst = cartTotal - cartSubtotal;

  return {
    cartItems,
    pricing,
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
    isSessionExpired,
    resetGuestSession,
    isHydrated,
  };
};
