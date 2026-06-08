import { create } from 'zustand';
import type { Product, CartItem, CustomerCategory, AutoOffer, Coupon } from '@/lib/types';
import { toast } from '../hooks/use-toast';
import { offerDiscountService } from '@/lib/offer-discount-service';
import { logger } from '@/lib/logger';

export interface CartPricing {
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
  marketingAlert?: {
    type: string;
    title: string;
    message: string;
    action: string;
  };
  bulkUpsells?: Array<{
    productId: string;
    message: string;
  }>;
}

const GUEST_SESSION_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const CART_STORAGE_PREFIX = 'tecbunny';
const CART_STORAGE_NAMES = ['cart', 'appliedCoupon', 'cartLastUpdated', 'abandonedEmailSent'] as const;

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

export interface CartState {
  cartItems: CartItem[];
  pricing: CartPricing;
  isSessionExpired: boolean;
  isHydrated: boolean;
  isMergingAccountCart: boolean;

  // Actions
  addToCart: (item: Product, quantity: number, user: any, trackEvent: any) => void;
  removeFromCart: (itemId: string, user: any, trackEvent: any) => void;
  updateQuantity: (itemId: string, quantity: number, user: any) => void;
  clearCart: (user: any) => void;
  applyCoupon: (coupon: Coupon, user: any, customerCategory?: CustomerCategory) => Promise<boolean>;
  removeCoupon: (user: any, customerCategory?: CustomerCategory) => void;
  refreshPricing: (currentAppliedCoupon: Coupon | null | undefined, user: any, customerCategory?: CustomerCategory) => Promise<void>;
  resetGuestSession: () => void;
  clearCartMemory: () => void;
  
  // Initialization & Sync
  loadCartFromStorage: (user: any) => void;
  saveCartToStorage: (user: any) => void;
  checkSessionExpiry: (user: any) => void;
  checkAbandonedCart: (user: any) => void;
  mergeGuestCartWithUserCart: (userId: string, supabaseClient: any) => Promise<void>;
}

const defaultPricing: CartPricing = {
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
};

const getStorageKey = (key: string, user: any) => {
  if (user) {
    return `${CART_STORAGE_PREFIX}_${key}_user_${user.id}`;
  }
  return `${CART_STORAGE_PREFIX}_${key}_guest`;
};

const removeLegacyStorageKeys = () => {
  if (typeof localStorage === 'undefined') return;

  [
    'cart',
    'appliedCoupon',
    'cartLastUpdated',
    'abandonedEmailSent',
    'cart_guest',
    'appliedCoupon_guest',
  ].forEach((key) => localStorage.removeItem(key));
};

const removeCartStorageForUser = (user: any) => {
  CART_STORAGE_NAMES.forEach((key) => localStorage.removeItem(getStorageKey(key, user)));
};

const readStorageWithLegacyFallback = (key: string, user: any): string | null => {
  const scopedKey = getStorageKey(key, user);
  const scopedValue = localStorage.getItem(scopedKey);

  if (scopedValue !== null) {
    return scopedValue;
  }

  if (!user) {
    return localStorage.getItem(`${key}_guest`) ?? localStorage.getItem(key);
  }

  return localStorage.getItem(`${key}_user_${user.id}`);
};

const isGuestSessionExpired = (user: any) => {
  if (user) return false;
  const sessionStart = localStorage.getItem('guestSessionStart');
  if (!sessionStart) return false;
  const sessionStartTime = parseInt(sessionStart);
  return (Date.now() - sessionStartTime) > GUEST_SESSION_DURATION;
};

const initializeGuestSession = (user: any) => {
  if (user) return;
  if (!localStorage.getItem('guestSessionStart')) {
    localStorage.setItem('guestSessionStart', Date.now().toString());
  }
};

export const useCartStore = create<CartState>((set, get) => ({
  cartItems: [],
  pricing: defaultPricing,
  isSessionExpired: false,
  isHydrated: false,
  isMergingAccountCart: false,

  resetGuestSession: () => {
    localStorage.removeItem('guestSessionStart');
    removeCartStorageForUser(null);
    removeLegacyStorageKeys();
    
    set({
      cartItems: [],
      pricing: defaultPricing,
      isSessionExpired: false,
    });
    
    toast({
      title: "Session Reset",
      description: "Your guest session has been reset. Your cart is now empty.",
      variant: "default",
    });
  },

  loadCartFromStorage: (user: any) => {
    try {
      if (get().isMergingAccountCart) {
        return;
      }

      if (user?.role === 'superadmin') {
        set({ cartItems: [], pricing: defaultPricing, isHydrated: true });
        const cartKey = getStorageKey('cart', user);
        const couponKey = getStorageKey('appliedCoupon', user);
        localStorage.removeItem(cartKey);
        localStorage.removeItem(couponKey);
        return;
      }

      if (!user && isGuestSessionExpired(user)) {
        set({ isSessionExpired: true });
        get().resetGuestSession();
        return;
      }

      const storedCart = readStorageWithLegacyFallback('cart', user);
      const storedCoupon = readStorageWithLegacyFallback('appliedCoupon', user);
      
      let newCartItems: CartItem[] = [];
      const newPricing = { ...get().pricing };

      if (storedCart) {
        const parsedCart = JSON.parse(storedCart);
        newCartItems = Array.isArray(parsedCart) ? parsedCart.map(normalizeCartItem) : [];
      }
      
      if (storedCoupon) {
        newPricing.appliedCoupon = JSON.parse(storedCoupon);
      }

      set({ cartItems: newCartItems, pricing: newPricing, isHydrated: true });
      initializeGuestSession(user);
      
    } catch (error) {
      logger.error("Failed to parse cart from localStorage", { error });
      get().resetGuestSession();
    }
  },

  saveCartToStorage: (user: any) => {
    if (user?.role === 'superadmin') return;

    const state = get();
    if (!state.isHydrated || state.isMergingAccountCart) return;
    
    if (!user && isGuestSessionExpired(user)) {
      set({ isSessionExpired: true });
      return;
    }

    try {
      const cartKey = getStorageKey('cart', user);
      const couponKey = getStorageKey('appliedCoupon', user);
      
      localStorage.setItem(cartKey, JSON.stringify(state.cartItems));
      if (state.pricing.appliedCoupon) {
        localStorage.setItem(couponKey, JSON.stringify(state.pricing.appliedCoupon));
      } else {
        localStorage.removeItem(couponKey);
      }
      localStorage.setItem(getStorageKey('cartLastUpdated', user), Date.now().toString());
    } catch (error) {
      logger.error("Failed to save cart to localStorage", { error });
    }
  },

  checkSessionExpiry: (user: any) => {
    if (user || !get().isHydrated) return;
    if (isGuestSessionExpired(user)) {
      set({ isSessionExpired: true });
      get().resetGuestSession();
    }
  },

  refreshPricing: async (currentAppliedCoupon, user, customerCategory) => {
    const state = get();
    if (!user && isGuestSessionExpired(user)) {
      set({ isSessionExpired: true });
      return;
    }

    const appliedCoupon = currentAppliedCoupon !== undefined ? currentAppliedCoupon : state.pricing.appliedCoupon;

    if (state.cartItems.length === 0) {
      set({
        pricing: {
          ...defaultPricing,
          appliedCoupon,
        }
      });
      return;
    }

    try {
      const res = await fetch('/api/checkout/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: state.cartItems,
          customerCategory: customerCategory,
          couponCode: appliedCoupon?.code
        })
      });

      if (!res.ok) throw new Error('Failed to calculate checkout totals via API');

      const pricingData = await res.json();
      set({
        pricing: {
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
          marketingAlert: pricingData.marketingAlert,
          bulkUpsells: pricingData.bulkUpsells,
        }
      });
    } catch (error) {
      logger.error('Error calculating pricing', { error });

      let calculatedSubtotal = 0;
      let calculatedGstAmount = 0;
      state.cartItems.forEach((item) => {
        const gstRate = typeof item.gstRate === 'number' ? item.gstRate : 18;
        const itemTotal = item.price * item.quantity;
        const basePrice = Math.round((itemTotal / (1 + (gstRate / 100))) * 100) / 100;
        const itemGst = Math.round((itemTotal - basePrice) * 100) / 100;
        calculatedSubtotal += basePrice;
        calculatedGstAmount += itemGst;
      });
      const grossSubtotal = state.cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

      set({
        pricing: {
          subtotal: Math.max(0, calculatedSubtotal),
          autoOffer: null,
          autoOfferDiscount: 0,
          appliedCoupon,
          couponDiscount: 0,
          totalDiscount: 0,
          gstAmount: calculatedGstAmount,
          finalTotal: Math.max(0, grossSubtotal),
          availableCoupons: [],
          canCombineDiscounts: false,
        }
      });
    }
  },

  checkAbandonedCart: (user: any) => {
    const state = get();
    if (!state.isHydrated || !user || state.isSessionExpired) return;

    const timestampKey = getStorageKey('cartLastUpdated', user);
    const abandonedEmailKey = getStorageKey('abandonedEmailSent', user);
    
    const lastUpdated = localStorage.getItem(timestampKey);
    const abandonedEmailSent = localStorage.getItem(abandonedEmailKey);
    
    if (state.cartItems.length > 0 && lastUpdated && !abandonedEmailSent) {
      const lastUpdateTime = new Date(lastUpdated);
      const now = new Date();
      const minutesSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60);
      
      if (minutesSinceUpdate >= 15) {
        fetch('/api/email/abandoned-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            userName: user.name,
            cartItems: state.cartItems.map(item => ({
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
  },

  addToCart: (item, quantity = 1, user, trackEvent) => {
    if (user?.role === 'superadmin') {
      toast({
        title: "Access Blocked",
        description: "Superadmin accounts cannot initialize a cart or place orders.",
        variant: "destructive"
      });
      return;
    }

    if (!user && isGuestSessionExpired(user)) {
      set({ isSessionExpired: true });
      toast({
        title: "Session Expired",
        description: "Your guest session has expired. Please reset to continue shopping.",
        variant: "destructive",
      });
      return;
    }

    const isServiceItem = item.product_type === 'service' || item.id?.startsWith('service-') || item.id?.startsWith('pricing-');
    const normalizedQuantity = isServiceItem ? 1 : quantity;

    set((state) => {
      const existingItem = state.cartItems.find((cartItem) => cartItem.id === item.id);
      let newItems;
      if (existingItem) {
        newItems = state.cartItems.map((cartItem) =>
          cartItem.id === item.id
            ? normalizeCartItem({ ...cartItem, quantity: isServiceItem ? 1 : cartItem.quantity + normalizedQuantity })
            : cartItem
        );
      } else {
        newItems = [...state.cartItems, normalizeCartItem({ ...item, quantity: normalizedQuantity })];
      }
      return { cartItems: newItems };
    });
    
    trackEvent?.('add_to_cart', { 
      productId: item.id, 
      productName: item.name, 
      price: item.price, 
      quantity: normalizedQuantity 
    });

    toast({
      title: "Added to cart",
      description: `${item.name} has been added to your cart.`,
    });
    
    get().saveCartToStorage(user);
    get().refreshPricing(undefined, user);
  },

  removeFromCart: (itemId, user, trackEvent) => {
    if (!user && isGuestSessionExpired(user)) {
      set({ isSessionExpired: true });
      return;
    }

    const state = get();
    const itemToRemove = state.cartItems.find(item => item.id === itemId);
    if (itemToRemove) {
      trackEvent?.('remove_from_cart', { 
        productId: itemToRemove.id, 
        productName: itemToRemove.name 
      });
    }

    set({ cartItems: state.cartItems.filter((item) => item.id !== itemId) });
    toast({
      title: "Item removed",
      description: "The item has been removed from your cart.",
    });

    get().saveCartToStorage(user);
    get().refreshPricing(undefined, user);
  },

  updateQuantity: (itemId, quantity, user) => {
    if (user?.role === 'superadmin') return;

    if (!user && isGuestSessionExpired(user)) {
      set({ isSessionExpired: true });
      return;
    }

    if (quantity <= 0) {
      get().removeFromCart(itemId, user, null); // trackEvent null here as it was missing in original
    } else {
      set((state) => ({
        cartItems: state.cartItems.map((item) => {
          if (item.id !== itemId) return item;
          const isServiceItem = item.product_type === 'service' || item.id?.startsWith('service-') || item.id?.startsWith('pricing-');
          const nextQuantity = isServiceItem ? 1 : quantity;
          return normalizeCartItem({ ...item, quantity: nextQuantity });
        })
      }));
      get().saveCartToStorage(user);
      get().refreshPricing(undefined, user);
    }
  },

  clearCart: (user) => {
    set({ cartItems: [], pricing: defaultPricing });
    
    const cartKey = getStorageKey('cart', user);
    const couponKey = getStorageKey('appliedCoupon', user);
    const timestampKey = getStorageKey('cartLastUpdated', user);
    const abandonedEmailKey = getStorageKey('abandonedEmailSent', user);
    
    localStorage.removeItem(cartKey);
    localStorage.removeItem(couponKey);
    localStorage.removeItem(timestampKey);
    localStorage.removeItem(abandonedEmailKey);
    
    toast({
      title: "Cart cleared",
      description: "All items have been removed from your cart.",
    });
  },

  applyCoupon: async (coupon, user, customerCategory) => {
    if (user?.role === 'superadmin') {
      return false;
    }

    if (!user && isGuestSessionExpired(user)) {
      set({ isSessionExpired: true });
      toast({
        title: "Session Expired",
        description: "Your guest session has expired. Please reset to continue.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const state = get();
      const cartTotalAmount = state.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const validation = await offerDiscountService.isCouponApplicable(coupon, state.cartItems, cartTotalAmount);
      
      if (!validation) {
        toast({
          title: "Coupon Invalid",
          description: "This coupon cannot be applied to your cart.",
          variant: "destructive",
        });
        return false;
      }
      
      const couponKey = getStorageKey('appliedCoupon', user);
      localStorage.setItem(couponKey, JSON.stringify(coupon));
      
      toast({
        title: "Coupon Applied!",
        description: `${coupon.code} has been applied to your cart.`,
      });
      
      await get().refreshPricing(coupon, user, customerCategory);
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
  },

  removeCoupon: (user, customerCategory) => {
    if (!user && isGuestSessionExpired(user)) {
      set({ isSessionExpired: true });
      return;
    }
    
    const couponKey = getStorageKey('appliedCoupon', user);
    localStorage.removeItem(couponKey);
    
    toast({
      title: "Coupon Removed",
      description: "The coupon has been removed from your cart.",
    });
    
    get().refreshPricing(null, user, customerCategory);
  },

  mergeGuestCartWithUserCart: async (userId: string, supabaseClient: any) => {
    if (userId === 'superadmin-root-id') return;

    try {
      set({ isMergingAccountCart: true });
      const guestCartRaw = typeof window !== 'undefined' ? readStorageWithLegacyFallback('cart', null) : null;
      const guestItems: CartItem[] = guestCartRaw ? JSON.parse(guestCartRaw) : [];
      const inMemoryItems = get().cartItems || [];
      
      const user = { id: userId };
      const userCartKey = getStorageKey('cart', user);
      const userCartRaw = typeof window !== 'undefined' ? localStorage.getItem(userCartKey) : null;
      const userItems: CartItem[] = userCartRaw ? JSON.parse(userCartRaw) : [];

      const mergedMap = new Map<string, CartItem>();

      const addItemToMerge = (item: CartItem) => {
        if (!item?.id) return;
        const normalizedItem = normalizeCartItem(item);
        const existing = mergedMap.get(normalizedItem.id);
        if (existing) {
          const isServiceItem =
            normalizedItem.product_type === 'service' ||
            normalizedItem.id?.startsWith('service-') ||
            normalizedItem.id?.startsWith('pricing-');
          existing.quantity = isServiceItem ? 1 : existing.quantity + normalizedItem.quantity;
        } else {
          mergedMap.set(normalizedItem.id, { ...normalizedItem });
        }
      };

      userItems.forEach(addItemToMerge);
      guestItems.forEach(addItemToMerge);
      inMemoryItems.forEach(addItemToMerge);

      const mergedItems = Array.from(mergedMap.values());

      set({ cartItems: mergedItems, isHydrated: true });

      if (typeof window !== 'undefined') {
        // Save to user storage
        localStorage.setItem(userCartKey, JSON.stringify(mergedItems));
        
        // Clean up guest local storage
        removeCartStorageForUser(null);
        localStorage.removeItem('guestSessionStart');
        removeLegacyStorageKeys();
      }

      // Refresh pricing for the newly merged cart
      await get().refreshPricing(undefined, user);
      
      logger.info('Cart guest-to-user merge complete', { userId, itemsCount: mergedItems.length });
    } catch (error) {
      logger.error('Failed to merge guest cart with user cart', { error });
    } finally {
      set({ isMergingAccountCart: false });
    }
  },

  clearCartMemory: () => {
    if (typeof window !== 'undefined') {
      try {
        const prefixes = [`${CART_STORAGE_PREFIX}_cart_`, `${CART_STORAGE_PREFIX}_appliedCoupon_`, `${CART_STORAGE_PREFIX}_cartLastUpdated_`, `${CART_STORAGE_PREFIX}_abandonedEmailSent_`];
        for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
          const key = window.localStorage.key(index);
          if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
            window.localStorage.removeItem(key);
          }
        }
        removeLegacyStorageKeys();
        window.localStorage.removeItem('guestSessionStart');
      } catch (e) {}
    }
    set({
      cartItems: [],
      pricing: defaultPricing,
      isSessionExpired: false,
      isHydrated: true,
      isMergingAccountCart: false,
    });
  },
}));
