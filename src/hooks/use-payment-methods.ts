import { useState, useEffect } from 'react';

import { logger } from '@/lib/logger';

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'online' | 'offline';
  enabled: boolean;
  config?: {
    keyId?: string;
    secretKey?: string;
    merchantId?: string;
    saltKey?: string;
    saltIndex?: string;
    appId?: string;
    publishableKey?: string;
    merchantKey?: string;
    merchantSalt?: string;
    websiteName?: string;
    industryType?: string;
    channelId?: string;
    environment?: string;
    // COD specific
    minOrderAmount?: string;
    maxOrderAmount?: string;
    instructions?: string;
    // UPI specific
    upiId?: string;
    upiName?: string;
  };
}

export interface PaymentSettings {
  payu: PaymentMethod;
  cod: PaymentMethod;
  upi: PaymentMethod;
}

const defaultPaymentSettings: PaymentSettings = {
  payu: {
    id: 'payu',
    name: 'PayU',
    type: 'online',
    enabled: true,
    config: {
      environment: 'test' // Configure via VS Code: 'test' or 'production'
    }
  },
  cod: {
    id: 'cod',
    name: 'Cash on Delivery',
    type: 'offline',
    enabled: true,
    config: {}
  },
  upi: {
    id: 'upi',
    name: 'UPI/QR Code',
    type: 'offline',
    enabled: true,
    config: {}
  }
};

export function usePaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentSettings>(defaultPaymentSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentSettings = async () => {
    // Settings are now managed via code (VS Code)
    // We simulate a fetch by just setting the default (hardcoded) settings
    setLoading(false);
    setPaymentMethods(defaultPaymentSettings);
  };

  const updatePaymentMethod = async (methodId: string, updates: Partial<PaymentMethod>) => {
    console.warn('Payment settings are managed via code. Updates via UI are disabled.');
    return { success: false, error: 'Settings are managed via code' };
  };

  const getEnabledPaymentMethods = () => {
    return Object.values(paymentMethods).filter(method => method.enabled);
  };

  const getOnlinePaymentMethods = () => {
    return Object.values(paymentMethods).filter(method => method.enabled && method.type === 'online');
  };

  const getOfflinePaymentMethods = () => {
    return Object.values(paymentMethods).filter(method => method.enabled && method.type === 'offline');
  };

  useEffect(() => {
    fetchPaymentSettings();
  }, []);

  return {
    paymentMethods,
    loading,
    error,
    updatePaymentMethod,
    fetchPaymentSettings,
    getEnabledPaymentMethods,
    getOnlinePaymentMethods,
    getOfflinePaymentMethods
  };
}