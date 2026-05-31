'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';

import type { Product, CartItem, CustomerCategory, AutoOffer, Coupon } from '../lib/types';
import { useToast } from '../hooks/use-toast';
import { offerDiscountService } from '../lib/offer-discount-service';
import { useAuth } from '../lib/hooks';
import { logger } from '../lib/logger';
import { useAnalytics } from '../hooks/use-analytics';

interface CartPricing {
  subtotal: number;
  autoOffer: AutoOffer | null;
  autoOfferDiscount: number;
  appliedCoupon: Coupon | null;
  couponDiscount: number;
  totalDiscount: number;
  gstAmount: number;
  finalTotal: number;
  availableCoupons: Coupon[];
  canCombineDiscounts: boolean;
}

interface CartContextType {
  cartItems: CartItem[];
  pricing: CartPricing;
  addToCart: (item: Product, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (coupon: Coupon) => Promise<boolean>;
  removeCoupon: () => void;
  refreshPricing: (currentAppliedCoupon?: Coupon | null) => Promise<void>;
  cartCount: number;
  cartSubtotal: number;
  cartGst: number;
  cartTotal: number;
  isSessionExpired: boolean;
  resetGuestSession: () => void;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

const GUEST_SESSION_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

const resolveHsnCode = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const resolveGstRate = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeCartItem = (item: any): CartItem => {
  const normalizedHsn = resolveHsnCode(
    item?.hsnCode ?? item?.hsn_code ?? item?.hsn ?? item?.hsn_sac ?? item?.hsnsac ?? item?.hsnSac
  );
  const normalizedGst = resolveGstRate(item?.gstRate ?? item?.gst_rate ?? item?.gst ?? item?.gstpercentage);

  return {
    ...item,
    hsnCode: normalizedHsn ?? item?.hsnCode,
    gstRate: normalizedGst ?? item?.gstRate,
  };
};

export const CartProvider: React.FC<{ 
  children: React.ReactNode;
  customerCategory?: CustomerCategory;
}> = ({ children, customerCategory }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [pricing, setPricing] = useState<CartPricing>({
    subtotal: 0,
    autoOffer: null,
    autoOfferDiscount: 0,
    appliedCoupon: null,
    couponDiscount: 0,
    totalDiscount: 0,
    gstAmount: 0,
    finalTotal: 0,
    availableCoupons: [],
    canCombineDiscounts: false,
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();
  const [isHydrated, setIsHydrated] = useState(false);

  // Check if guest session is expired
  const isGuestSessionExpired = useCallback(() => {
    if (user) return false; // Logged-in users don't have session expiry
    
    const sessionStart = localStorage.getItem('guestSessionStart');
    if (!sessionStart) return false;
    
    const sessionStartTime = parseInt(sessionStart);
    const now = Date.now();
    
    return (now - sessionStartTime) > GUEST_SESSION_DURATION;
  }, [user]);

  // Initialize guest session
  const initializeGuestSession = useCallback(() => {
    if (user) return; // Only for guest users
    
    const existingSession = localStorage.getItem('guestSessionStart');
    if (!existingSession) {
      localStorage.setItem('guestSessionStart', Date.now().toString());
    }
  }, [user]);

  // Reset guest session
  const resetGuestSession = useCallback(() => {
    if (user) return; // Only affects guest users
    
    localStorage.removeItem('guestSessionStart');
    localStorage.removeItem('cart');
    localStorage.removeItem('appliedCoupon');
    localStorage.removeItem('cartLastUpdated');
    localStorage.removeItem('abandonedEmailSent');
    
    setCartItems([]);
    setPricing({
      subtotal: 0,
      autoOffer: null,
      autoOfferDiscount: 0,
      appliedCoupon: null,
      couponDiscount: 0,
      totalDiscount: 0,
      gstAmount: 0,
      finalTotal: 0,
      availableCoupons: [],
      canCombineDiscounts: false,
    });
    setIsSessionExpired(false);
    
    toast({
      title: "Session Reset",
      description: "Your guest session has been reset. Your cart is now empty.",
      variant: "default",
    });
  }, [user, toast]);

  // Get storage key based on user status
  const getStorageKey = useCallback((key: string) => {
    if (user) {
      return `${key}_user_${user.id}`;
    }
    return `${key}_guest`;
  }, [user]);

  // Load cart from storage with session check
  const loadCartFromStorage = useCallback(() => {
    try {
      // Check if guest session expired
      if (!user && isGuestSessionExpired()) {
        setIsSessionExpired(true);
        resetGuestSession();
        return;
      }

      const cartKey = getStorageKey('cart');
      const couponKey = getStorageKey('appliedCoupon');
      
      const storedCart = localStorage.getItem(cartKey);
      const storedCoupon = localStorage.getItem(couponKey);
      
      if (storedCart) {
        const parsedCart = JSON.parse(storedCart);
        const normalizedCart = Array.isArray(parsedCart)
          ? parsedCart.map(normalizeCartItem)
          : [];
        setCartItems(normalizedCart);
      }
      
      if (storedCoupon) {
        const coupon = JSON.parse(storedCoupon);
        setPricing(prev => ({ ...prev, appliedCoupon: coupon }));
      }

      // Initialize guest session if needed
      initializeGuestSession();
      
    } catch (error) {
      logger.error("Failed to parse cart from localStorage", { error });
      resetGuestSession();
    }
  }, [user, isGuestSessionExpired, resetGuestSession, getStorageKey, initializeGuestSession]);

  // Save cart to storage
  const saveCartToStorage = useCallback(() => {
    if (!isHydrated) return;
    
    // Don't save if session is expired
    if (!user && isGuestSessionExpired()) {
      setIsSessionExpired(true);
      return;
    }

    const cartKey = getStorageKey('cart');
    const couponKey = getStorageKey('appliedCoupon');
    
    localStorage.setItem(cartKey, JSON.stringify(cartItems));
    
    if (pricing.appliedCoupon) {
      localStorage.setItem(couponKey, JSON.stringify(pricing.appliedCoupon));
    } else {
      localStorage.removeItem(couponKey);
    }
    
    // Update cart timestamp for session tracking
    if (cartItems.length > 0) {
      const timestampKey = getStorageKey('cartLastUpdated');
      localStorage.setItem(timestampKey, new Date().toISOString());
    }
  }, [isHydrated, cartItems, pricing.appliedCoupon, getStorageKey, user, isGuestSessionExpired]);

  // Load cart on component mount and when user changes
  useEffect(() => {
    loadCartFromStorage();
    setIsHydrated(true);
  }, [user, loadCartFromStorage]); // Reload when user changes (login/logout)

  // Set up session expiry check for guest users
  useEffect(() => {
    if (user || !isHydrated) return; // Only for guest users
    
    const checkSessionExpiry = () => {
      if (isGuestSessionExpired()) {
        setIsSessionExpired(true);
        resetGuestSession();
      }
    };

    // Check session expiry every minute
    const interval = setInterval(checkSessionExpiry, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user, isHydrated, isGuestSessionExpired, resetGuestSession]);

  // Calculate pricing whenever cart or customer category changes
  const refreshPricing = useCallback(async (currentAppliedCoupon?: Coupon | null) => {
    // Don't calculate pricing if session is expired
    if (!user && isGuestSessionExpired()) {
      setIsSessionExpired(true);
      return;
    }

    // Use the passed coupon or current applied coupon
    const appliedCoupon = currentAppliedCoupon !== undefined ? currentAppliedCoupon : pricing.appliedCoupon;

    if (cartItems.length === 0) {
      setPricing({
        subtotal: 0,
        autoOffer: null,
        autoOfferDiscount: 0,
        appliedCoupon,
        couponDiscount: 0,
        totalDiscount: 0,
        gstAmount: 0,
        finalTotal: 0,
        availableCoupons: [],
        canCombineDiscounts: false,
      });
      return;
    }

    try {
      // ONE API CALL to calculation endpoint
      const res = await fetch('/api/checkout/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: cartItems,
          customerCategory: customerCategory,
          couponCode: appliedCoupon?.code
        })
      });

      if (!res.ok) {
        throw new Error('Failed to calculate checkout totals via API');
      }

      const pricingData = await res.json();

      setPricing({
        subtotal: pricingData.subtotal,
        autoOffer: pricingData.bestOffer,
        autoOfferDiscount: pricingData.autoOfferDiscount,
        appliedCoupon,
        couponDiscount: pricingData.couponDiscount,
        totalDiscount: pricingData.totalDiscount,
        gstAmount: pricingData.gstAmount,
        finalTotal: pricingData.finalTotal,
        availableCoupons: pricingData.availableCoupons || [],
        canCombineDiscounts: pricingData.canCombineDiscounts,
      });

    } catch (error) {
      logger.error('Error calculating pricing', { error });

      const grossSubtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
      const gstAmount = cartItems.reduce((total, item) => {
        const gstRate = typeof item.gstRate === 'number' ? item.gstRate : 18;
        const itemTotal = item.price * item.quantity;
        const basePrice = itemTotal / (1 + (gstRate / 100));
        return total + (itemTotal - basePrice);
      }, 0);

      setPricing({
        subtotal: Math.max(0, grossSubtotal - gstAmount),
        autoOffer: null,
        autoOfferDiscount: 0,
        appliedCoupon,
        couponDiscount: 0,
        totalDiscount: 0,
        gstAmount,
        finalTotal: Math.max(0, grossSubtotal),
        availableCoupons: [],
        canCombineDiscounts: false,
      });
    }
  }, [cartItems, customerCategory, pricing.appliedCoupon, user, isGuestSessionExpired]);

  // Save cart and refresh pricing when cart changes
  useEffect(() => {
    if (isHydrated && !isSessionExpired) {
      saveCartToStorage();
      
      if (cartItems.length > 0) {
        refreshPricing();
      } else {
        // Clear applied coupon when cart is empty
        if (pricing.appliedCoupon) {
          const couponKey = getStorageKey('appliedCoupon');
          localStorage.removeItem(couponKey);
          refreshPricing(null); // Pass null as the coupon to clear it
        }
      }
    }
  }, [cartItems, isHydrated, isSessionExpired, saveCartToStorage, refreshPricing, getStorageKey, pricing.appliedCoupon]);

  // Set up abandoned cart tracking (only for logged-in users)
  useEffect(() => {
    if (!isHydrated || !user || isSessionExpired) return; // Only for logged-in users

    const checkAbandonedCart = () => {
      const timestampKey = getStorageKey('cartLastUpdated');
      const abandonedEmailKey = getStorageKey('abandonedEmailSent');
      
      const lastUpdated = localStorage.getItem(timestampKey);
      const abandonedEmailSent = localStorage.getItem(abandonedEmailKey);
      
      if (cartItems.length > 0 && lastUpdated && !abandonedEmailSent) {
        const lastUpdateTime = new Date(lastUpdated);
        const now = new Date();
        const minutesSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60);
        
        // Send abandoned cart email after 15 minutes
        if (minutesSinceUpdate >= 15) {
          // Trigger abandoned cart email
          fetch('/api/email/abandoned-cart', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: user.email,
              userName: user.name,
              cartItems: cartItems.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
              })),
              restoreCartUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/cart`,
              minutesSinceAbandoned: Math.floor(minutesSinceUpdate),
              phone: user.mobile
            }),
          }).then(() => {
            localStorage.setItem(abandonedEmailKey, 'true');
          }).catch((error) => {
            logger.error('Failed to send abandoned cart email', { error });
          });
        }
      }
    };

  // Check every 5 minutes
  const interval = setInterval(checkAbandonedCart, 5 * 60 * 1000);
    
    // Also check immediately
    checkAbandonedCart();

    return () => clearInterval(interval);
  }, [cartItems, isHydrated, user, isSessionExpired, getStorageKey]);

  const addToCart = useCallback((item: Product, quantity = 1) => {
    // Check session expiry for guest users
    if (!user && isGuestSessionExpired()) {
      setIsSessionExpired(true);
      toast({
        title: "Session Expired",
        description: "Your guest session has expired. Please reset to continue shopping.",
        variant: "destructive",
      });
      return;
    }

    const isServiceItem = item.product_type === 'service' || item.id?.startsWith('service-') || item.id?.startsWith('pricing-');
    const normalizedQuantity = isServiceItem ? 1 : quantity;

    setCartItems((prevItems) => {
      const existingItem = prevItems.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return prevItems.map((cartItem) =>
          cartItem.id === item.id
            ? normalizeCartItem({ ...cartItem, quantity: isServiceItem ? 1 : cartItem.quantity + normalizedQuantity })
            : cartItem
        );
      }
      return [...prevItems, normalizeCartItem({ ...item, quantity: normalizedQuantity })];
    });
    
    trackEvent('add_to_cart', { 
      productId: item.id, 
      productName: item.name, 
      price: item.price, 
      quantity: normalizedQuantity 
    });

    toast({
      title: "Added to cart",
      description: `${item.name} has been added to your cart.`,
    });
  }, [toast, user, isGuestSessionExpired, trackEvent]);

  const removeFromCart = useCallback((itemId: string) => {
    // Check session expiry for guest users
    if (!user && isGuestSessionExpired()) {
      setIsSessionExpired(true);
      return;
    }

    const itemToRemove = cartItems.find(item => item.id === itemId);
    if (itemToRemove) {
      trackEvent('remove_from_cart', { 
        productId: itemToRemove.id, 
        productName: itemToRemove.name 
      });
    }

    setCartItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
    toast({
      title: "Item removed",
      description: "The item has been removed from your cart.",
    });
  }, [toast, user, isGuestSessionExpired, cartItems, trackEvent]);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    // Check session expiry for guest users
    if (!user && isGuestSessionExpired()) {
      setIsSessionExpired(true);
      return;
    }

    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCartItems((prevItems) =>
        prevItems.map((item) => {
          if (item.id !== itemId) return item;
          const isServiceItem = item.product_type === 'service' || item.id?.startsWith('service-') || item.id?.startsWith('pricing-');
          const nextQuantity = isServiceItem ? 1 : quantity;
          return normalizeCartItem({ ...item, quantity: nextQuantity });
        })
      );
    }
  }, [removeFromCart, user, isGuestSessionExpired]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setPricing(prev => ({ ...prev, appliedCoupon: null }));
    
    // Reset all session tracking
    const cartKey = getStorageKey('cart');
    const couponKey = getStorageKey('appliedCoupon');
    const timestampKey = getStorageKey('cartLastUpdated');
    const abandonedEmailKey = getStorageKey('abandonedEmailSent');
    
    localStorage.removeItem(cartKey);
    localStorage.removeItem(couponKey);
    localStorage.removeItem(timestampKey);
    localStorage.removeItem(abandonedEmailKey);
    
    toast({
      title: "Cart cleared",
      description: "All items have been removed from your cart.",
    });
  }, [getStorageKey, toast]);

  const applyCoupon = useCallback(async (coupon: Coupon): Promise<boolean> => {
    // Check session expiry for guest users
    if (!user && isGuestSessionExpired()) {
      setIsSessionExpired(true);
      toast({
        title: "Session Expired",
        description: "Your guest session has expired. Please reset to continue.",
        variant: "destructive",
      });
      return false;
    }

    try {
      // Validate coupon against cart
  const cartTotalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const validation = await offerDiscountService.isCouponApplicable(coupon, cartItems, cartTotalAmount);
      
      if (!validation) {
        toast({
          title: "Coupon Invalid",
          description: "This coupon cannot be applied to your cart.",
          variant: "destructive",
        });
        return false;
      }
      
      const couponKey = getStorageKey('appliedCoupon');
      localStorage.setItem(couponKey, JSON.stringify(coupon));
      
      toast({
        title: "Coupon Applied!",
        description: `${coupon.code} has been applied to your cart.`,
      });
      
      // Refresh pricing with the new coupon
      await refreshPricing(coupon);
      
      return true;
    } catch (error) {
      logger.error('Error applying coupon', { error, couponCode: coupon.code });
      toast({
        title: "Error",
        description: "Failed to apply coupon. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [cartItems, toast, refreshPricing, getStorageKey, user, isGuestSessionExpired]);

  const removeCoupon = useCallback(() => {
    // Check session expiry for guest users
    if (!user && isGuestSessionExpired()) {
      setIsSessionExpired(true);
      return;
    }
    
    const couponKey = getStorageKey('appliedCoupon');
    localStorage.removeItem(couponKey);
    
    toast({
      title: "Coupon Removed",
      description: "The coupon has been removed from your cart.",
    });
    
    // Refresh pricing without the coupon
    refreshPricing(null);
  }, [toast, getStorageKey, user, isGuestSessionExpired, refreshPricing]);

  // Legacy computed values for backward compatibility
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  const cartSubtotal = cartItems.reduce((total, item) => {
    const price = item.price;
    const gstRate = typeof item.gstRate === 'number' ? item.gstRate : 18;
    const basePrice = price / (1 + (gstRate / 100));
    return total + basePrice * item.quantity;
  }, 0);

  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  const cartGst = cartTotal - cartSubtotal;

  // Handle session expiry UI
  const handleSessionExpired = useCallback(() => {
    setIsSessionExpired(true);
    toast({
      title: "Session Expired",
      description: "Your guest session has expired after 1 hour of inactivity. Cart has been reset.",
      variant: "destructive",
      action: (
        <button
          onClick={() => {
            resetGuestSession();
            setIsSessionExpired(false);
          }}
          className="bg-white text-black px-3 py-1 rounded text-sm hover:bg-gray-100"
        >
          Continue Shopping
        </button>
      ),
    });
  }, [toast, resetGuestSession]);

  // Check for session expiry on cart access
  useEffect(() => {
    if (!user && isGuestSessionExpired() && cartItems.length > 0) {
      handleSessionExpired();
      resetGuestSession();
    }
  }, [user, isGuestSessionExpired, cartItems.length, handleSessionExpired, resetGuestSession]);

  const value = {
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
    resetGuestSession: () => {
      resetGuestSession();
      setIsSessionExpired(false);
    },
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
