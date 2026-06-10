import { Metadata } from 'next';
import { Suspense } from 'react';

import CheckoutPage from '@/components/checkout/CheckoutPage';

// Force dynamic rendering for checkout page
// export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout | Complete Your Purchase',
  description: 'Complete your purchase securely. Enter shipping details, select payment method, and review your order before checkout.',
  keywords: 'checkout, payment, shipping, order completion, secure payment'
};

export default function Checkout() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#030712] text-slate-300">
        <div className="text-slate-400">Loading checkout...</div>
      </div>
    }>
      <CheckoutPage />
    </Suspense>
  );
}
