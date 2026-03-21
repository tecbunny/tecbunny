import EditProductPage from './sales-product-edit';

export async function generateStaticParams() {
  return [{ id: '1' }];
}

export default function Page() {
  return <EditProductPage />;
}

