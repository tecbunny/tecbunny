import { Metadata } from 'next';

import CheckoutPage from '../../components/checkout/CheckoutPage';

// Force dynamic rendering for checkout page
// export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout | Complete Your Purchase',
  description: 'Complete your purchase securely. Enter shipping details, select payment method, and review your order before checkout.',
  keywords: 'checkout, payment, shipping, order completion, secure payment'
};

export default function Checkout() {
  return <CheckoutPage />;
}
