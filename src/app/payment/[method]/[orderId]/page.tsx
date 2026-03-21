import PaymentClientPage from './PaymentClientPage';

export async function generateStaticParams() {
  return [{ orderId: '1', method: '1' }];
}

export default function Page() {
  return <PaymentClientPage />;
}


