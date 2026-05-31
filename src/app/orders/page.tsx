import { Metadata } from 'next';

import OrdersListPage from '@/components/orders/OrdersListPage';

// Force dynamic rendering for order pages
// export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Orders | Order History & Tracking',
  description: 'View your order history, track shipments, and manage your orders. Check order status, delivery information, and download invoices.',
  keywords: 'orders, order history, tracking, shipment, delivery status, invoices'
};

export default function Orders() {
  return <OrdersListPage />;
}
