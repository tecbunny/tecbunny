'use client';

import { useState, useEffect } from 'react';

import { logger } from '@/lib/logger';

import { createClient } from '@/lib/supabase/client';
import type { CustomerCategory } from '@/lib/types';

interface Discount {
  type: 'category' | 'offer';
  title: string;
  percentage: number;
  amount: number;
  description: string;
  validUntil?: string;
}

interface DiscountCalculation {
  discounts: Discount[];
  totalDiscount: number;
  totalDiscountPercentage: number;
  originalAmount: number;
  finalAmount: number;
  customerCategory?: CustomerCategory;
  isLoading: boolean;
  error: string | null;
}

export function useCustomerDiscounts(userId: string | undefined, orderValue: number) {
  const [calculation, setCalculation] = useState<DiscountCalculation>({
    discounts: [],
    totalDiscount: 0,
    totalDiscountPercentage: 0,
    originalAmount: orderValue,
    finalAmount: orderValue,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!userId || orderValue <= 0) {
      setCalculation(prev => ({
        ...prev,
        originalAmount: orderValue,
        finalAmount: orderValue,
        isLoading: false,
      }));
      return;
    }

    const calculateDiscounts = async () => {
      setCalculation(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(
          `/api/discounts/calculate?userId=${userId}&orderValue=${orderValue}`
        );

        if (!response.ok) {
          throw new Error('Failed to calculate discounts');
        }

        const data = await response.json();
        
        setCalculation({
          ...data,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        logger.error('Error calculating discounts:', { error });
        setCalculation(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to calculate discounts',
        }));
      }
    };

    calculateDiscounts();
  }, [userId, orderValue]);

  return calculation;
}

// Hook to get customer category and discount info
export function useCustomerCategory(userId: string | undefined) {
  const [customerInfo, setCustomerInfo] = useState<{
    category?: CustomerCategory;
    discountPercentage: number;
    isLoading: boolean;
    error: string | null;
  }>({
    discountPercentage: 0,
    isLoading: false,
    error: null,
  });

  const supabase = createClient();

  useEffect(() => {
    if (!userId) {
      setCustomerInfo(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const fetchCustomerInfo = async () => {
      setCustomerInfo(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, customer_category, discount_percentage')
          .eq('id', userId)
          .single();

        if (error) throw error;

        if (data.role === 'customer') {
          setCustomerInfo({
            category: data.customer_category,
            discountPercentage: data.discount_percentage || 0,
            isLoading: false,
            error: null,
          });
        } else {
          setCustomerInfo({
            discountPercentage: 0,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        logger.error('Error fetching customer info:', { error });
        setCustomerInfo(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to fetch customer information',
        }));
      }
    };

    fetchCustomerInfo();
  }, [userId, supabase]);

  return customerInfo;
}

// Hook to get active offers for a customer category
export function useCustomerOffers(category: CustomerCategory | undefined) {
  const [offers, setOffers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!category) {
      setOffers([]);
      return;
    }

    const fetchOffers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const today = new Date().toISOString();
        const { data, error } = await supabase
          .from('customer_offers')
          .select('*')
          .eq('is_active', true)
          .lte('valid_from', today)
          .gte('valid_to', today)
          .contains('target_categories', [category])
          .order('discount_percentage', { ascending: false });

        if (error) throw error;

        setOffers(data || []);
      } catch (error) {
        logger.error('Error fetching offers:', { error });
        setError('Failed to fetch offers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffers();
  }, [category, supabase]);

  return { offers, isLoading, error };
}