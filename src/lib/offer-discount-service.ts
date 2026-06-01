'use client';

import type { CartItem, CustomerCategory, AutoOffer, Coupon } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

import { logger } from './logger';
import { resolveSiteUrl } from './site-url';

type MarketingOfferRecord = {
    id: string;
    title?: string;
    description?: string;
    discount_type?: string;
    discount_value?: number | string;
    applicable_categories?: string[];
    minimum_purchase_amount?: number | string;
    customer_eligibility?: string;
    priority?: number | string;
    maximum_discount_amount?: number | string;
    usage_limit?: number | string;
    usage_count?: number | string;
    usage_limit_per_customer?: number | string;
    start_date?: string;
    end_date?: string;
    created_at?: string;
    updated_at?: string;
    offer_code?: string;
    is_active?: boolean;
};

/**
 * Enhanced Offer and Discount Service
 * Handles auto-offers and manual discounts with combination rules
 */
export class OfferDiscountService {
    private supabase = createClient();
    
    /**
     * Get all active auto-offers
     */
    async getActiveOffers(): Promise<AutoOffer[]> {
        const now = new Date().toISOString();

        // Prefer the dedicated auto-offers API (service-role powered on the server).
        try {
            let url = `/api/auto-offers?active=true&t=${encodeURIComponent(now)}`;
            if (typeof window === 'undefined') {
                url = `${resolveSiteUrl()}${url}`;
            }
            const response = await fetch(url, {
                headers: { 'Cache-Control': 'no-store' }
            });

            if (response.ok) {
                const payload = await response.json();
                const offers = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
                const normalized = this.normalizeOffers(offers, now);
                if (normalized.length > 0) {
                    return normalized;
                }
            } else {
                const details = await response.json().catch(() => null);
                logger.warn('OfferDiscountService.getActiveOffers.api_failed', { status: response.status, details });
            }
        } catch (err) {
            logger.warn('OfferDiscountService.getActiveOffers.api_error', { error: err });
        }

        // Fallback: query the table directly via the anon Supabase client (requires read RLS).
        try {
            const { data, error } = await this.supabase
                .from('auto_offers')
                .select('*')
                .eq('is_active', true)
                .order('priority', { ascending: false });

            if (!error) {
                const normalized = this.normalizeOffers(data ?? [], now);
                if (normalized.length > 0) {
                    return normalized;
                }
            } else {
                logger.error('OfferDiscountService.getActiveOffers.supabase_failed', { error: error.message });
            }
        } catch (fallbackError) {
            logger.error('OfferDiscountService.getActiveOffers.supabase_error', { error: fallbackError });
        }

        // Final fallback: adapt marketing offers (from /api/offers) into auto-applied discounts.
        return this.fetchMarketingOffersFallback(now);
    }

    private async fetchMarketingOffersFallback(now: string): Promise<AutoOffer[]> {
        const offers = await this.fetchMarketingOffersPayload();
        if (!offers.length) {
            return [];
        }
        return this.normalizeOffers(this.mapMarketingOffersToAutoOffers(offers, now), now);
    }

    private mapMarketingOffersToAutoOffers(records: MarketingOfferRecord[], nowIso: string): AutoOffer[] {
        return records
            .filter((offer) => offer && offer.is_active && !offer.offer_code) // Only auto-applied promos
            .map((offer) => {
                const discountType = (offer.discount_type ?? '').toLowerCase();
                const discountValue = typeof offer.discount_value === 'number' ? offer.discount_value : Number(offer.discount_value) || 0;
                const categories = Array.isArray(offer.applicable_categories) ? offer.applicable_categories.filter(Boolean) : undefined;
                const minOrder = typeof offer.minimum_purchase_amount === 'number'
                    ? offer.minimum_purchase_amount
                    : Number(offer.minimum_purchase_amount) || undefined;
                const priority = typeof offer.priority === 'number' ? offer.priority : Number(offer.priority) || 0;

                const autoOffer: AutoOffer = {
                    id: offer.id,
                    title: offer.title ?? 'Special Offer',
                    description: offer.description ?? '',
                    type: 'seasonal',
                    discount_percentage: discountType === 'percentage' ? discountValue : undefined,
                    discount_amount: discountType !== 'percentage' ? discountValue : undefined,
                    conditions: {
                        customer_category: this.normalizeCustomerEligibility(offer.customer_eligibility),
                        minimum_order_value: minOrder,
                        applicable_categories: categories,
                        applicable_product_ids: undefined,
                        valid_from: offer.start_date || nowIso,
                        valid_to: offer.end_date || nowIso,
                    },
                    is_active: true,
                    auto_apply: true,
                    priority,
                    max_discount_amount: typeof offer.maximum_discount_amount === 'number'
                        ? offer.maximum_discount_amount
                        : Number(offer.maximum_discount_amount) || undefined,
                    created_at: offer.created_at || nowIso,
                    updated_at: offer.updated_at || undefined,
                };

                return autoOffer;
            })
            .filter((offer) => (offer.discount_amount ?? 0) > 0 || (offer.discount_percentage ?? 0) > 0);
    }

    private mapMarketingOffersToCoupons(records: MarketingOfferRecord[], nowIso: string): Coupon[] {
        return records
            .filter((offer) => offer && offer.is_active && Boolean(offer.offer_code))
            .map((offer) => {
                const couponType = this.normalizeCouponType(offer.discount_type);
                const couponValue = this.parseNumber(offer.discount_value) ?? 0;
                const minPurchase = this.parseNumber(offer.minimum_purchase_amount);
                const usageLimit = this.parseNumber(offer.usage_limit) ?? 0;
                const usageCount = this.parseNumber(offer.usage_count) ?? 0;
                const perUserLimit = this.parseNumber(offer.usage_limit_per_customer) ?? 0;
                const startDate = offer.start_date || nowIso;
                const endDate = offer.end_date || nowIso;

                const coupon: Coupon = {
                    id: offer.id,
                    code: String(offer.offer_code).toUpperCase(),
                    type: couponType,
                    value: couponValue > 0 ? couponValue : 0,
                    start_date: startDate,
                    expiry_date: endDate,
                    min_purchase: typeof minPurchase === 'number' && minPurchase > 0 ? minPurchase : undefined,
                    usage_limit: usageLimit,
                    usage_count: usageCount,
                    per_user_limit: perUserLimit,
                    status: offer.is_active ? 'active' : 'inactive',
                    applicable_category: undefined,
                    applicable_product_id: undefined,
                };

                return coupon;
            })
            .filter((coupon) => {
                if (!coupon.code || coupon.value <= 0) {
                    return false;
                }
                return this.isWithinDateRange(coupon.start_date, coupon.expiry_date, nowIso);
            });
    }

    private async fetchMarketingOffersPayload(): Promise<MarketingOfferRecord[]> {
        try {
            let url = '/api/offers?active=true';
            if (typeof window === 'undefined') {
                url = `${resolveSiteUrl()}${url}`;
            }
            const response = await fetch(url, { headers: { 'Cache-Control': 'no-store' } });
            if (!response.ok) {
                const details = await response.json().catch(() => null);
                logger.warn('OfferDiscountService.marketing.fetch_failed', { status: response.status, details });
                return [];
            }
            const payload = await response.json();
            const rows = Array.isArray((payload as { offers?: MarketingOfferRecord[] })?.offers)
                ? ((payload as { offers?: MarketingOfferRecord[] }).offers ?? [])
                : (Array.isArray(payload) ? (payload as MarketingOfferRecord[]) : []);
            return Array.isArray(rows) ? rows.filter(Boolean) : [];
        } catch (error) {
            logger.error('OfferDiscountService.marketing.fetch_error', { error });
            return [];
        }
    }

    private normalizeOffers(rawOffers: AutoOffer[], nowIso: string): AutoOffer[] {
        const nowTime = new Date(nowIso);

        return (rawOffers || [])
            .filter((offer) => offer?.is_active && offer?.auto_apply)
            .map((offer) => {
                let parsedConditions: AutoOffer['conditions'] = offer.conditions;

                if (typeof parsedConditions === 'string') {
                    try {
                        parsedConditions = JSON.parse(parsedConditions);
                    } catch (parseError) {
                        logger.warn('OfferDiscountService.getActiveOffers.condition_parse_failed', {
                            offerId: offer.id,
                            error: parseError
                        });
                        parsedConditions = {} as AutoOffer['conditions'];
                    }
                }

                const normalizedConditions = parsedConditions || {} as AutoOffer['conditions'];

                const validFrom = normalizedConditions?.valid_from ? new Date(normalizedConditions.valid_from) : null;
                const validTo = normalizedConditions?.valid_to ? new Date(normalizedConditions.valid_to) : null;

                if (validFrom && Number.isFinite(validFrom.getTime()) && validFrom > nowTime) {
                    return null;
                }

                if (validTo && Number.isFinite(validTo.getTime()) && validTo < nowTime) {
                    return null;
                }

                return {
                    ...offer,
                    conditions: normalizedConditions
                };
            })
            .filter((offer): offer is AutoOffer => Boolean(offer));
    }

    private normalizeCustomerEligibility(value?: string | null): CustomerCategory[] | undefined {
        if (!value) return undefined;
        const normalized = String(value).trim().toLowerCase();
        if (!normalized || normalized === 'all') {
            return undefined;
        }

        const mapping: Record<string, CustomerCategory> = {
            normal: 'Normal',
            standard: 'Standard',
            premium: 'Premium',
        };

        const match = mapping[normalized];
        return match ? [match] : undefined;
    }

    async getActiveCoupons(): Promise<Coupon[]> {
        const now = new Date().toISOString();

        const [couponResult, marketingOffers] = await Promise.all([
            this.supabase
                .from('coupons')
                .select('*')
                .eq('status', 'active')
                .lte('start_date', now)
                .gte('expiry_date', now),
            this.fetchMarketingOffersPayload()
        ]);

        if (couponResult.error) {
            logger.error('OfferDiscountService.getActiveCoupons.supabase_failed', { error: couponResult.error });
        }

        const directCoupons = couponResult.data ?? [];
        const marketingCoupons = marketingOffers.length ? this.mapMarketingOffersToCoupons(marketingOffers, now) : [];

        return [...directCoupons, ...marketingCoupons];
    }
    
    /**
     * Check if an offer is applicable to the cart
     */
    isOfferApplicable(
        offer: AutoOffer, 
        cartItems: CartItem[], 
        customerCategory?: CustomerCategory,
        cartTotal: number = 0
    ): boolean {
        const { conditions } = offer;
        
        // Check customer category
        if (conditions.customer_category && customerCategory) {
            if (!conditions.customer_category.includes(customerCategory)) {
                return false;
            }
        }
        
        // Check minimum order value
        if (conditions.minimum_order_value && cartTotal < conditions.minimum_order_value) {
            return false;
        }
        
        // Check applicable categories
        if (conditions.applicable_categories && conditions.applicable_categories.length > 0) {
            const hasApplicableCategory = cartItems.some(item => 
                conditions.applicable_categories!.includes(item.category)
            );
            if (!hasApplicableCategory) {
                return false;
            }
        }
        
        // Check applicable products
        if (conditions.applicable_product_ids && conditions.applicable_product_ids.length > 0) {
            const hasApplicableProduct = cartItems.some(item => 
                conditions.applicable_product_ids!.includes(item.id)
            );
            if (!hasApplicableProduct) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Check if a coupon is applicable to the cart
     */
    isCouponApplicable(
        coupon: Coupon, 
        cartItems: CartItem[], 
        cartTotal: number = 0
    ): boolean {
        // Check minimum purchase
        if (coupon.min_purchase && cartTotal < coupon.min_purchase) {
            return false;
        }
        
        // Check applicable category
        if (coupon.applicable_category) {
            const hasApplicableCategory = cartItems.some(item => 
                item.category === coupon.applicable_category
            );
            if (!hasApplicableCategory) {
                return false;
            }
        }
        
        // Check applicable product
        if (coupon.applicable_product_id) {
            const hasApplicableProduct = cartItems.some(item => 
                item.id === coupon.applicable_product_id
            );
            if (!hasApplicableProduct) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Calculate offer discount amount
     */
    calculateOfferDiscount(
        offer: AutoOffer, 
        cartItems: CartItem[], 
        cartTotal: number
    ): number {
        let applicableAmount = 0;
        
        // Calculate applicable amount based on offer type
        if (offer.conditions.applicable_categories && offer.conditions.applicable_categories.length > 0) {
            // Category-specific offer
            applicableAmount = cartItems
                .filter(item => offer.conditions.applicable_categories!.includes(item.category))
                .reduce((sum, item) => sum + (item.price * item.quantity), 0);
        } else if (offer.conditions.applicable_product_ids && offer.conditions.applicable_product_ids.length > 0) {
            // Product-specific offer
            applicableAmount = cartItems
                .filter(item => offer.conditions.applicable_product_ids!.includes(item.id))
                .reduce((sum, item) => sum + (item.price * item.quantity), 0);
        } else {
            // General offer applies to entire cart
            applicableAmount = cartTotal;
        }
        
        let discount = 0;
        
        if (offer.discount_percentage) {
            discount = (applicableAmount * offer.discount_percentage) / 100;
        } else if (offer.discount_amount) {
            discount = Math.min(offer.discount_amount, applicableAmount);
        }
        
        // Apply maximum discount limit if specified
        if (offer.max_discount_amount) {
            discount = Math.min(discount, offer.max_discount_amount);
        }
        
        return Math.round(discount * 100) / 100; // Round to 2 decimal places
    }
    
    /**
     * Calculate coupon discount amount
     */
    calculateCouponDiscount(
        coupon: Coupon, 
        cartItems: CartItem[], 
        cartTotal: number
    ): number {
        let applicableAmount = 0;
        
        // Calculate applicable amount
        if (coupon.applicable_category) {
            applicableAmount = cartItems
                .filter(item => item.category === coupon.applicable_category)
                .reduce((sum, item) => sum + (item.price * item.quantity), 0);
        } else if (coupon.applicable_product_id) {
            applicableAmount = cartItems
                .filter(item => item.id === coupon.applicable_product_id)
                .reduce((sum, item) => sum + (item.price * item.quantity), 0);
        } else {
            applicableAmount = cartTotal;
        }
        
        let discount = 0;
        
        if (coupon.type === 'percentage') {
            discount = (applicableAmount * coupon.value) / 100;
        } else if (coupon.type === 'fixed') {
            discount = Math.min(coupon.value, applicableAmount);
        }
        
        return Math.round(discount * 100) / 100;
    }
    
    /**
     * Find the best applicable offer for the cart
     */
    async getBestOffer(
        cartItems: CartItem[], 
        customerCategory?: CustomerCategory, 
        cartTotal: number = 0
    ): Promise<AutoOffer | null> {
        const offers = await this.getActiveOffers();
        const applicableOffers = offers.filter(offer => 
            this.isOfferApplicable(offer, cartItems, customerCategory, cartTotal)
        );
        
        if (applicableOffers.length === 0) {
            return null;
        }
        
        // Find offer with highest discount amount
        let bestOffer = applicableOffers[0];
        let bestDiscount = this.calculateOfferDiscount(bestOffer, cartItems, cartTotal);
        
        for (const offer of applicableOffers.slice(1)) {
            const discount = this.calculateOfferDiscount(offer, cartItems, cartTotal);
            if (discount > bestDiscount) {
                bestOffer = offer;
                bestDiscount = discount;
            }
        }
        
        return bestOffer;
    }
    
    /**
     * Get applicable coupons for the cart
     */
    async getApplicableCoupons(
        cartItems: CartItem[], 
        cartTotal: number = 0
    ): Promise<Coupon[]> {
        const coupons = await this.getActiveCoupons();
        return coupons.filter(coupon => 
            this.isCouponApplicable(coupon, cartItems, cartTotal)
        );
    }
    
    /**
     * Calculate cart pricing with offers and discounts
     */
    async calculateCartPricing(
        cartItems: CartItem[],
        customerCategory?: CustomerCategory,
        selectedCoupon?: Coupon
    ): Promise<{
        subtotal: number;
        bestOffer: AutoOffer | null;
        offerDiscount: number;
        couponDiscount: number;
        totalDiscount: number;
        finalTotal: number;
        availableCoupons: Coupon[];
        canCombine: boolean;
    }> {
        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Get best auto-offer
        const bestOffer = await this.getBestOffer(cartItems, customerCategory, subtotal);
        const offerDiscount = bestOffer ? this.calculateOfferDiscount(bestOffer, cartItems, subtotal) : 0;
        
        // Calculate coupon discount if selected
        let couponDiscount = 0;
        if (selectedCoupon && this.isCouponApplicable(selectedCoupon, cartItems, subtotal)) {
            couponDiscount = this.calculateCouponDiscount(selectedCoupon, cartItems, subtotal);
        }
        
        // Get available coupons
        const availableCoupons = await this.getApplicableCoupons(cartItems, subtotal);
        
        // Determine if offer and coupon can be combined
        // Rule: Can combine if they apply to different aspects (e.g., offer on category, coupon on specific product)
        const canCombine = this.canCombineOfferAndCoupon(bestOffer, selectedCoupon, cartItems);
        
        // Calculate total discount (don't stack same type, but allow combination)
        let totalDiscount = 0;
        if (canCombine && bestOffer && selectedCoupon) {
            totalDiscount = offerDiscount + couponDiscount;
        } else {
            // Take the better of the two
            totalDiscount = Math.max(offerDiscount, couponDiscount);
        }
        
        const finalTotal = Math.max(0, subtotal - totalDiscount);
        
        return {
            subtotal,
            bestOffer,
            offerDiscount: canCombine ? offerDiscount : (offerDiscount >= couponDiscount ? offerDiscount : 0),
            couponDiscount: canCombine ? couponDiscount : (couponDiscount > offerDiscount ? couponDiscount : 0),
            totalDiscount,
            finalTotal,
            availableCoupons,
            canCombine
        };
    }
    
    /**
     * Check if offer and coupon can be combined
     */
    private canCombineOfferAndCoupon(
        offer: AutoOffer | null, 
        coupon: Coupon | undefined, 
        _cartItems: CartItem[]
    ): boolean {
        if (!offer || !coupon) return false;
        
        // Don't combine if both are general (apply to entire cart)
        const offerIsGeneral = !offer.conditions.applicable_categories?.length && 
                              !offer.conditions.applicable_product_ids?.length;
        const couponIsGeneral = !coupon.applicable_category && !coupon.applicable_product_id;
        
        if (offerIsGeneral && couponIsGeneral) {
            return false;
        }
        
        // Don't combine if they target the same products/categories
        if (offer.conditions.applicable_categories?.includes(coupon.applicable_category!)) {
            return false;
        }
        
        if (offer.conditions.applicable_product_ids?.includes(coupon.applicable_product_id!)) {
            return false;
        }
        
        return true;
    }
    private normalizeCouponType(value?: string | null): Coupon['type'] {
        const normalized = (value ?? '').toLowerCase();
        if (normalized === 'fixed' || normalized === 'fixed_amount' || normalized === 'amount') {
            return 'fixed';
        }
        return 'percentage';
    }

    private parseNumber(value: unknown): number | undefined {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim().length > 0) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
    }

    private isWithinDateRange(start: string, end: string, nowIso: string): boolean {
        const now = new Date(nowIso).getTime();
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();

        if (Number.isFinite(startTime) && startTime > now) {
            return false;
        }

        if (Number.isFinite(endTime) && endTime < now) {
            return false;
        }

        return true;
    }
}

// Export singleton instance
export const offerDiscountService = new OfferDiscountService();