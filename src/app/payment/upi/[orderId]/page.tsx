import UPIClientPage from './UPIClientPage';

export async function generateStaticParams() {
  return [{ orderId: '1' }];
}

export default function Page() {
  return <UPIClientPage />;
}


