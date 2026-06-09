import { useState } from 'react';

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
    minOrderAmount?: string;
    maxOrderAmount?: string;
    instructions?: string;
    upiId?: string;
    upiName?: string;
  };
}

export interface PaymentSettings {
  payu: PaymentMethod;
  cod: PaymentMethod;
  upi: PaymentMethod;
}

const staticPaymentSettings: PaymentSettings = {
  payu: {
    id: 'payu',
    name: 'PayU',
    type: 'online',
    enabled: true,
    config: {
      environment: 'test'
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
  const [paymentMethods] = useState<PaymentSettings>(staticPaymentSettings);

  const fetchPaymentSettings = async () => {
    // No-op: Settings are strictly managed via codebase configuration.
  };

  const updatePaymentMethod = async (methodId: string, updates: Partial<PaymentMethod>) => {
    // Updates via UI are disabled as payment options are code-driven
    return { success: false, error: 'Payment configurations are code-managed.' };
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

  return {
    paymentMethods,
    loading: false,
    error: null,
    updatePaymentMethod,
    fetchPaymentSettings,
    getEnabledPaymentMethods,
    getOnlinePaymentMethods,
    getOfflinePaymentMethods
  };
}