import { pricingService, PricingContext } from './pricing-service';
import { offerDiscountService } from './offer-discount-service';
import { enhancedCommissionService } from './enhanced-commission-service';
import type { CartItem, Product, CustomerCategory, Coupon, AutoOffer } from './types';
import { logger } from './logger';

export interface CheckoutEngineRequest {
  items: CartItem[];
  userId?: string;
  customerCategory?: CustomerCategory;
  couponCode?: string;
  salesAgentId?: string; // Optional agent ID to calculate commissions
}

export interface CheckoutEngineResponse {
  subtotal: number;
  totalDiscount: number;
  autoOfferDiscount: number;
  couponDiscount: number;
  gstAmount: number;
  finalTotal: number;
  
  bestOffer: AutoOffer | null;
  appliedCoupon: Coupon | null;
  availableCoupons: Coupon[];
  canCombineDiscounts: boolean;

  itemPrices: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    discount_amount: number;
    pricing_info: any;
  }>;

  commissionEstimate?: {
    agent_id: string;
    commission_amount: number;
    commission_rate: number;
  };
}

export class CheckoutEngine {
  /**
   * Unified calculation for the entire cart.
   * This is the single mathematical source of truth.
   */
  async calculate(request: CheckoutEngineRequest): Promise<CheckoutEngineResponse> {
    const { items, userId, customerCategory, couponCode, salesAgentId } = request;

    if (!items || items.length === 0) {
      return this.emptyResponse();
    }

    try {
      // 1. Get pricing context (B2B vs B2C logic)
      const pricingContext: PricingContext = userId 
        ? await pricingService.getCustomerPricingContext(userId)
        : { customer_type: 'B2C', customer_category: customerCategory || 'Normal' };

      // 2. Base Pricing Calculation per item
      const itemPrices = [];
      let grossSubtotal = 0; // Sum of item price * quantity before discounts and GST

      // Retrieve verified pricing source of truth from database to prevent client-side price manipulation
      const productIds = items.map(item => item.id);
      const supabase = await pricingService['getSupabaseClient']();
      const { data: dbProducts, error: dbError } = await supabase
        .from('products')
        .select('id, price, mrp, status, is_deleted, gstRate, gst_rate, offer_price')
        .in('id', productIds);
      
      if (dbError || !dbProducts) {
        logger.error('Failed to fetch pricing product metadata from database', { dbError });
        throw new Error('Verification of product prices failed. Please try again.');
      }

      const dbProductMap = new Map(dbProducts.map(p => [p.id, p]));

      // Convert CartItems to Product array for PricingService using verified database metadata
      const productsForPricing = items.map(item => {
        const dbProduct = dbProductMap.get(item.id);
        if (!dbProduct || dbProduct.is_deleted || dbProduct.status !== 'active') {
          throw new Error(`Product ${item.id} is invalid or no longer available.`);
        }
        return {
          product: {
            ...item,
            price: dbProduct.price,
            mrp: dbProduct.mrp,
            offer_price: dbProduct.offer_price,
            gstRate: dbProduct.gstRate ?? dbProduct.gst_rate ?? 18
          } as unknown as Product,
          quantity: item.quantity
        };
      });

      // Calculate initial pricing using pricing service
      const pricingResult = await pricingService.calculateCartTotal(productsForPricing, pricingContext);
      
      // Update items with their actual pricing for discount calculation
      const pricedItems: CartItem[] = items.map((item, index) => {
        const pInfo = pricingResult.item_prices[index];
        return {
          ...item,
          price: pInfo.unit_price // Use the final price from pricing service as base
        };
      });

      grossSubtotal = pricedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // 3. Discount Application
      let appliedCoupon: Coupon | null = null;
      if (couponCode) {
        const availableCoupons = await offerDiscountService.getActiveCoupons();
        const found = availableCoupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase());
        if (found) appliedCoupon = found;
      }

      const discountResult = await offerDiscountService.calculateCartPricing(
        pricedItems,
        pricingContext.customer_category as CustomerCategory,
        appliedCoupon || undefined
      );

      // 4. GST Calculation based on post-discount subtotal
      let gstAmount = 0;
      const totalDiscountApplied = discountResult.totalDiscount;
      
      // Proportionally apply discount to calculate accurate GST per item
      const discountRatio = grossSubtotal > 0 ? (totalDiscountApplied / grossSubtotal) : 0;
      
      const itemPricesWithTaxes = pricedItems.map((item, index) => {
        const pInfo = pricingResult.item_prices[index];
        const itemGross = item.price * item.quantity;
        const itemDiscount = itemGross * discountRatio;
        const itemNet = itemGross - itemDiscount;
        
        const gstRate = typeof item.gstRate === 'number' ? item.gstRate : 18;
        // Assuming price includes GST, reverse calculate GST from net amount.
        // Wait, pricing service says "Calculate GST (18% for most IT products)" by adding to subtotal.
        // The original CartProvider extracts GST from inclusive price: basePrice = price / (1 + gstRate/100).
        const basePrice = itemNet / (1 + (gstRate / 100));
        const itemGst = itemNet - basePrice;
        gstAmount += itemGst;

        return {
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: itemGross,
          discount_amount: itemDiscount,
          pricing_info: pInfo.pricing_info
        };
      });

      const finalTotal = Math.max(0, grossSubtotal - totalDiscountApplied);
      const finalSubtotal = Math.max(0, grossSubtotal - gstAmount); // Subtotal without GST

      // 5. Commission Calculation (Estimate)
      let commissionEstimate = undefined;
      if (salesAgentId) {
        try {
          // Pre-tax amount for commission
          const preTaxAmount = finalTotal - gstAmount;
          
          // Simulate an order calculation
          // We bypass actual order creation and use calculateItemCommission logic indirectly
          // by mocking the structure EnhancedCommissionService expects or doing a basic estimate.
          // Since we just need an estimate, we can fetch rules and compute.
          const { data: agent } = await pricingService['getSupabaseClient']().then(s => 
             s.from('sales_agents').select('commission_rate').eq('id', salesAgentId).single()
          ).catch(() => ({ data: null }));

          const defaultRate = agent?.commission_rate || 5;
          commissionEstimate = {
            agent_id: salesAgentId,
            commission_amount: Math.round((preTaxAmount * defaultRate) / 100 * 100) / 100,
            commission_rate: defaultRate
          };
        } catch (err) {
          logger.warn('Failed to estimate commission in checkout engine', { err });
        }
      }

      return {
        subtotal: finalSubtotal,
        totalDiscount: totalDiscountApplied,
        autoOfferDiscount: discountResult.offerDiscount,
        couponDiscount: discountResult.couponDiscount,
        gstAmount,
        finalTotal,
        bestOffer: discountResult.bestOffer,
        appliedCoupon,
        availableCoupons: discountResult.availableCoupons,
        canCombineDiscounts: discountResult.canCombine,
        itemPrices: itemPricesWithTaxes,
        commissionEstimate
      };

    } catch (error) {
      logger.error('Checkout Engine Calculation Failed', { error });
      // Fallback
      const grossSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return {
        ...this.emptyResponse(),
        subtotal: grossSubtotal,
        finalTotal: grossSubtotal,
      };
    }
  }

  private emptyResponse(): CheckoutEngineResponse {
    return {
      subtotal: 0,
      totalDiscount: 0,
      autoOfferDiscount: 0,
      couponDiscount: 0,
      gstAmount: 0,
      finalTotal: 0,
      bestOffer: null,
      appliedCoupon: null,
      availableCoupons: [],
      canCombineDiscounts: false,
      itemPrices: []
    };
  }
}

export const checkoutEngine = new CheckoutEngine();
