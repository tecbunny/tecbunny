import OrderConfirmationPage from '../../../components/orders/OrderConfirmationPage';

// Force dynamic rendering for order detail pages
// export const dynamic = 'force-dynamic';

interface OrderDetailsPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const { orderId } = await params;

  return <OrderConfirmationPage orderId={orderId} />;
}

export async function generateStaticParams() {
  return [{ orderId: '1' }]
}


