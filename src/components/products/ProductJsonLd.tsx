import { Product } from '@/lib/types';
import { stripHtmlToPlainText } from '@/lib/strings';

export default function ProductJsonLd({ product }: { product: Product }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tecbunny.com';
  const name = stripHtmlToPlainText(product.title || product.name, 80) || 'Premium Product';
  const description = stripHtmlToPlainText(product.description, 500) ||
    `Quality ${product.category || 'technology'} hardware available at TecBunny.`;
  const price = Number(product.price ?? product.offer_price ?? 0);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': name,
    'image': product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []),
    'description': description,
    'sku': product.barcode || product.id,
    'mpn': product.model_number || product.id,
    'brand': {
      '@type': 'Brand',
      'name': product.brand || product.vendor || 'TecBunny',
    },
    'offers': {
      '@type': 'Offer',
      'url': `${siteUrl}/products/${product.handle || product.id}`,
      'priceCurrency': 'INR',
      'price': Number.isFinite(price) ? String(price) : '0',
      'itemCondition': 'https://schema.org/NewCondition',
      'availability': product.stock_quantity && product.stock_quantity > 0 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
      'seller': { '@id': `${siteUrl}/#localbusiness` },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
    />
  );
}
