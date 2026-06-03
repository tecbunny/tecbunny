import { Product } from '@/lib/types';

export default function ProductJsonLd({ product }: { product: Product }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.title || product.name,
    'image': product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []),
    'description': product.description,
    'sku': product.barcode || product.id,
    'mpn': product.model_number || product.id,
    'brand': {
      '@type': 'Brand',
      'name': product.brand || product.vendor || 'TecBunny',
    },
    'offers': {
      '@type': 'Offer',
      'url': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tecbunny.com'}/products/${product.handle || product.id}`,
      'priceCurrency': 'INR',
      'price': product.price,
      'itemCondition': 'https://schema.org/NewCondition',
      'availability': product.stock_quantity && product.stock_quantity > 0 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
