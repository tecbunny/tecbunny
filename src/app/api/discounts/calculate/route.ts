import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '../../../../lib/supabase/server';

// export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const orderValue = searchParams.get('orderValue');

    if (!userId) {
      return NextResponse.json(
        { message: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user profile with customer category
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('role, customer_category, discount_percentage')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // If not a customer, no discounts apply
    if (user.role !== 'customer') {
      return NextResponse.json({
        discounts: [],
        totalDiscount: 0,
        finalAmount: parseFloat(orderValue || '0')
      });
    }

    const orderAmount = parseFloat(orderValue || '0');
    const discounts = [];
    let totalDiscountPercentage = 0;

    // Add category-based discount
    if (user.customer_category && user.discount_percentage > 0) {
      discounts.push({
        type: 'category',
        title: `${user.customer_category} Customer Discount`,
        percentage: user.discount_percentage,
        amount: (orderAmount * user.discount_percentage) / 100,
        description: `Automatic discount for ${user.customer_category} customers`
      });
      totalDiscountPercentage += user.discount_percentage;
    }

    // Get active offers for this customer category
    const today = new Date().toISOString();
    const { data: offers, error: offersError } = await supabase
      .from('customer_offers')
      .select('*')
      .eq('is_active', true)
      .lte('valid_from', today)
      .gte('valid_to', today)
      .contains('target_categories', user.customer_category ? [user.customer_category] : []);

    if (!offersError && offers) {
      for (const offer of offers) {
        // Check minimum order value
        if (offer.minimum_order_value && orderAmount < offer.minimum_order_value) {
          continue;
        }

        let discountAmount = (orderAmount * offer.discount_percentage) / 100;
        
        // Apply max discount limit if specified
        if (offer.max_discount_amount && discountAmount > offer.max_discount_amount) {
          discountAmount = offer.max_discount_amount;
        }

        discounts.push({
          type: 'offer',
          title: offer.title,
          percentage: offer.discount_percentage,
          amount: discountAmount,
          description: offer.description,
          validUntil: offer.valid_to
        });

        totalDiscountPercentage += offer.discount_percentage;
      }
    }

    // Calculate total discount amount
    const totalDiscountAmount = discounts.reduce((sum, discount) => sum + discount.amount, 0);
    const finalAmount = Math.max(0, orderAmount - totalDiscountAmount);

    return NextResponse.json({
      discounts,
      totalDiscount: totalDiscountAmount,
      totalDiscountPercentage,
      originalAmount: orderAmount,
      finalAmount,
      customerCategory: user.customer_category
    });

  } catch (error) {
    console.error('Error calculating discounts:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
