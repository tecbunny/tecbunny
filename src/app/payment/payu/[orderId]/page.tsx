import PayuClientPage from './PayuClientPage';

export async function generateStaticParams() {
  return [{ orderId: '1' }];
}

export default function Page() {
  return <PayuClientPage />;
}


