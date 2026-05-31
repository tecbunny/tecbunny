import { ProductDetailPage } from '@/components/products/ProductDetailPage';
import { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
import { createClient } from '@/lib/supabase/server';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();

  if (!product) {
    return createPageMetadata({
      title: 'Product Not Found',
      description: 'The requested product could not be found.',
      path: `/products/${id}`,
    });
  }

  return createPageMetadata({
    title: `${product.name} | TecBunny`,
    description: product.description || `Buy ${product.name} at TecBunny.`,
    path: `/products/${id}`,
    image: product.image_url || undefined,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();
  
  const jsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image_url || 'https://www.tecbunny.com/brand.png',
    description: product.description,
    sku: product.sku || id,
    brand: {
      '@type': 'Brand',
      name: 'TecBunny'
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: product.price,
      availability: product.stock_quantity && product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
    }
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetailPage productId={id} />
    </>
  );
}

export async function generateStaticParams() {
  return [{ id: '1' }]
}
