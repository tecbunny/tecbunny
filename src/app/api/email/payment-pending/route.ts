import { NextRequest } from 'next/server';

import { emailHelpers } from '@/lib/email';
import { handleEmailPost } from '@/lib/api-email-route';

interface PaymentPendingPayload { to: string; orderData: any; paymentData?: any }

export async function POST(request: NextRequest) {
  return handleEmailPost<PaymentPendingPayload>(request, {
    rate: { bucket: 'email_payment_pending', limit: 5, windowMs: 10 * 60 * 1000 },
    validate(body: any) {
      const { to, orderData, paymentData } = body || {};
      if (typeof to !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: 'Invalid recipient email' } as const;
      if (!orderData || typeof orderData !== 'object') return { ok: false, error: 'Invalid orderData' } as const;
      return { ok: true, data: { to, orderData, paymentData } } as const;
    },
    async action(data) {
      return emailHelpers.sendPaymentPending(data.to, data.orderData, data.paymentData || {});
    }
  });
}
