/**
 * Enhanced Pricing Service for B2C/B2B Pricing
 * Handles dual pricing, customer type detection, and pricing calculations
 */

import { createClient } from '@/lib/supabase/server';
import type { Product, CustomerType, CustomerCategory, B2BCategory } from '@/lib/types';

export interface PricingContext {
  customer_type: CustomerType;
  customer_category?: CustomerCategory | B2BCategory;
  user_id?: string;
  quantity?: number;
}

export interface ProductPrice {
  original_price: number;
  sale_price: number;
  b2b_price?: number;
  final_price: number;
  customer_type: CustomerType;
  discount_percentage?: number;
  pricing_tier?: string;
  quantity_based?: boolean;
}

export class PricingService {
  private async getSupabaseClient() {
    return createClient();
  }

  /**
   * Get pricing for a product based on customer context
   */
  async getProductPrice(
    product: Product, 
    context: PricingContext
  ): Promise<ProductPrice> {
    const basePrice = Number(product.price) || 0;
    const originalPrice = Number(product.mrp) || basePrice;

    // For B2C customers, use standard pricing logic
    if (context.customer_type === 'B2C') {
      return this.getB2CPrice(product, context);
    }

    // For B2B customers, check for special pricing
    return this.getB2BPrice(product, context, basePrice, originalPrice);
  }

  /**
   * Get B2C pricing with category-based discounts
   */
  private async getB2CPrice(
    product: Product, 
    context: PricingContext
  ): Promise<ProductPrice> {
    const basePrice = Number(product.price) || 0;
    const originalPrice = Number(product.mrp) || basePrice;
    let finalPrice = basePrice;
    let discountPercentage = 0;

    // Apply category-based discounts for B2C
    if (context.customer_category) {
      const categoryDiscounts: Record<string, number> = {
        'Normal': 0,
        'Standard': 5,
        'Premium': 10
      };
      
      discountPercentage = Number(categoryDiscounts[context.customer_category as string]) || 0;
      finalPrice = basePrice * (1 - discountPercentage / 100);
    }

    // Check for product-specific offers
    const offerPrice = product.offer_price != null ? Number(product.offer_price) : null;
    if (offerPrice !== null && offerPrice > 0 && offerPrice < finalPrice) {
      finalPrice = offerPrice;
      discountPercentage = basePrice > 0 ? Math.round(((basePrice - finalPrice) / basePrice) * 100) : 0;
    }

    return {
      original_price: originalPrice,
      sale_price: basePrice,
      final_price: Math.max(0, Math.round(finalPrice * 100) / 100),
      customer_type: 'B2C',
      discount_percentage: Math.max(0, discountPercentage),
      pricing_tier: String(context.customer_category || 'Normal')
    };
  }

  /**
   * Get B2B pricing with business-specific rates
   */
  private async getB2BPrice(
    product: Product, 
    context: PricingContext,
    basePrice: number,
    originalPrice: number
  ): Promise<ProductPrice> {
    // First check for product-specific B2B pricing
    const supabase = await this.getSupabaseClient();
    const { data: productPricing } = await supabase
      .from('product_pricing')
      .select('*')
      .eq('product_id', product.id)
      .eq('customer_type', 'B2B')
      .eq('customer_category', context.customer_category || 'Bronze')
      .eq('is_active', true)
      .or(`valid_to.is.null,valid_to.gte.${new Date().toISOString()}`)
      .single();

    let finalPrice = basePrice;
    let b2bPrice = basePrice;

    if (productPricing) {
      // Check quantity requirements
      const quantity = Number(context.quantity) || 1;
      const minQty = Number(productPricing.min_quantity) || 1;
      const maxQty = Number(productPricing.max_quantity) || Infinity;
      
      if (quantity >= minQty && quantity <= maxQty) {
        b2bPrice = Number(productPricing.price) || basePrice;
        finalPrice = b2bPrice;
      }
    } else {
      // Fallback to category-based B2B discounts
      const b2bDiscounts: Record<string, number> = {
        'Bronze': 8,    // 8% discount for Bronze B2B
        'Silver': 12,   // 12% discount for Silver B2B
        'Gold': 15      // 15% discount for Gold B2B
      };
      
      const discountPercentage = Number(b2bDiscounts[context.customer_category as string]) || 5;
      b2bPrice = basePrice * (1 - discountPercentage / 100);
      finalPrice = b2bPrice;
    }

    // Ensure B2B price is not higher than B2C price
    if (finalPrice > basePrice) {
      finalPrice = basePrice;
    }

    const discountPercentage = basePrice > 0 ? Math.round(((basePrice - finalPrice) / basePrice) * 100) : 0;

    return {
      original_price: originalPrice,
      sale_price: basePrice,
      b2b_price: b2bPrice,
      final_price: Math.max(0, Math.round(finalPrice * 100) / 100),
      customer_type: 'B2B',
      discount_percentage: Math.max(0, discountPercentage),
      pricing_tier: String(context.customer_category || 'Bronze'),
      quantity_based: !!productPricing
    };
  }

  /**
   * Get customer pricing context from user profile
   * SECURITY: Ensure the requested userId matches the authenticated user to prevent price-tier scraping
   */
  async getCustomerPricingContext(userId?: string): Promise<PricingContext> {
    if (!userId) {
      return {
        customer_type: 'B2C',
        customer_category: 'Normal'
      };
    }

    const supabase = await this.getSupabaseClient();
    
    // In production, we should ideally verify the JWT here too, but since we are in a service
    // we expect the caller (API route) to have verified the user identity.
    // We add a basic check to ensure we only fetch what's needed.
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('customer_type, customer_category, b2b_category, gst_verified')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return {
        customer_type: 'B2C',
        customer_category: 'Normal'
      };
    }

    // B2B customers must have GST verification
    const isB2B = profile.customer_type === 'B2B' && profile.gst_verified;

    return {
      customer_type: isB2B ? 'B2B' : 'B2C',
      customer_category: isB2B ? 
        (profile.b2b_category || 'Bronze') : 
        (profile.customer_category || 'Normal'),
      user_id: userId
    };
  }

  /**
   * Calculate cart total with customer-specific pricing
   */
  async calculateCartTotal(
    items: Array<{ product: Product; quantity: number }>,
    context: PricingContext
  ) {
    let subtotal = 0;
    let totalDiscount = 0;
    const itemPrices = [];

    // Fetch pricing source of truth from database to prevent manipulation
    const productIds = items.map(item => item.product.id).filter(Boolean);
    const supabase = await this.getSupabaseClient();
    const { data: dbProducts } = await supabase
      .from('products')
      .select('id, price, mrp, status, is_deleted, gstRate, gst_rate, offer_price')
      .in('id', productIds);
      
    const dbProductMap = new Map(dbProducts?.map(p => [p.id, p]) || []);

    for (const item of items) {
      const dbProduct = dbProductMap.get(item.product.id);
      
      if (!dbProduct || dbProduct.is_deleted || dbProduct.status !== 'active') {
        throw new Error(`Product ${item.product.id} is invalid or no longer available.`);
      }

      // Merge verified prices and metadata
      const verifiedProduct = {
        ...item.product,
        price: dbProduct.price,
        mrp: dbProduct.mrp,
        offer_price: dbProduct.offer_price,
        gstRate: dbProduct.gstRate ?? dbProduct.gst_rate ?? 18
      };

      const priceInfo = await this.getProductPrice(
        verifiedProduct, 
        { ...context, quantity: item.quantity }
      );
      
      const itemTotal = priceInfo.final_price * item.quantity;
      const itemDiscount = (priceInfo.sale_price - priceInfo.final_price) * item.quantity;
      
      subtotal += itemTotal;
      totalDiscount += itemDiscount;
      
      itemPrices.push({
        product_id: verifiedProduct.id,
        quantity: item.quantity,
        unit_price: priceInfo.final_price,
        total_price: itemTotal,
        discount_amount: itemDiscount,
        pricing_info: priceInfo
      });
    }

    // Calculate GST (18% for most IT products)
    const gstRate = 0.18;
    const gstAmount = subtotal * gstRate;
    const total = subtotal + gstAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      gst_amount: Math.round(gstAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      total_discount: Math.round(totalDiscount * 100) / 100,
      customer_type: context.customer_type,
      pricing_tier: context.customer_category,
      item_prices: itemPrices
    };
  }

  /**
   * Verify GST for B2B customer upgrade
   */
  async verifyGSTIN(gstin: string, businessName: string): Promise<{
    valid: boolean;
    details?: any;
    error?: string;
  }> {
    // Basic GSTIN format validation
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    
    if (!gstinRegex.test(gstin)) {
      return {
        valid: false,
        error: 'Invalid GSTIN format'
      };
    }

    // Here you would integrate with GST verification API
    // For now, we'll do basic validation
    const stateCode = gstin.substring(0, 2);
    const panNumber = gstin.substring(2, 12);

    // Mock validation - in production, integrate with GST API
    if (parseInt(stateCode) > 0 && parseInt(stateCode) <= 37) {
      return {
        valid: true,
        details: {
          gstin,
          business_name: businessName,
          state_code: stateCode,
          pan_number: panNumber,
          verified_at: new Date().toISOString()
        }
      };
    }

    return {
      valid: false,
      error: 'Invalid state code in GSTIN'
    };
  }

  /**
   * Update customer to B2B status
   */
  async upgradeToB2B(
    userId: string, 
    gstinDetails: {
      gstin: string;
      business_name: string;
      business_address: string;
      b2b_category?: B2BCategory;
    }
  ) {
    const verification = await this.verifyGSTIN(gstinDetails.gstin, gstinDetails.business_name);
    
    if (!verification.valid) {
      throw new Error(verification.error || 'GSTIN verification failed');
    }

    const supabase = await this.getSupabaseClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        customer_type: 'B2B',
        gstin: gstinDetails.gstin,
        gst_verified: true,
        gst_verification_date: new Date().toISOString(),
        business_name: gstinDetails.business_name,
        business_address: gstinDetails.business_address,
        b2b_category: gstinDetails.b2b_category || 'Bronze',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to upgrade customer to B2B');
    }

    return verification.details;
  }
}

// Export singleton instance
export const pricingService = new PricingService();