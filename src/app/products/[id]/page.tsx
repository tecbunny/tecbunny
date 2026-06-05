import { ProductDetailPage } from '@/components/products/ProductDetailPage';
import { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
import { createClient } from '@/lib/supabase/server';
import { BRAND_LOGO_URL } from '@/components/ui/logo';
import { stripHtmlToPlainText } from '@/lib/strings';

// ISR: revalidate every 5 minutes — dramatically reduces TTFB on product pages
export const revalidate = 300;
// force-static ensures Vercel edge caches the page (not private/no-store)
export const dynamic = 'force-static';

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

  const title = product.title || product.name || product.sku || 'Product';
  const rawDesc = product.description || product.details || '';
  const plainDesc = stripHtmlToPlainText(rawDesc, 160) ||
    `Buy ${title} at TecBunny. CCTV, IT and automation hardware in Goa.`;

  return createPageMetadata({
    title,
    description: plainDesc,
    path: `/products/${id}`,
    image: product.image || product.image_url || BRAND_LOGO_URL,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();

  const siteUrl = 'https://www.tecbunny.com';

  // Product JSON-LD — full schema with Offer, shippingDetails, seller reference
  const productJsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${siteUrl}/products/${id}#product`,
    name: product.title || product.name || product.sku || 'Product',
    sku: product.sku || product.handle || id,
    ...(product.model_number ? { mpn: product.model_number } : {}),
    brand: {
      '@type': 'Brand',
      name: product.brand || 'TecBunny',
    },
    ...(product.category ? { category: product.category } : {}),
    description: stripHtmlToPlainText(product.description || product.details, 500) ||
      `Quality ${product.category || 'technology'} hardware available at TecBunny.`,
    image: [
      product.image || product.image_url || BRAND_LOGO_URL,
    ].filter(Boolean),
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/products/${id}`,
      priceCurrency: 'INR',
      price: String(product.price ?? 0),
      priceValidUntil: '2026-12-31',
      availability:
        product.stock_quantity != null && product.stock_quantity > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${siteUrl}/#localbusiness` },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'INR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' },
        },
      },
    },
  } : null;

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${siteUrl}/products` },
      ...(product.category ? [{
        '@type': 'ListItem',
        position: 3,
        name: product.category,
        item: `${siteUrl}/products?category=${encodeURIComponent(product.category)}`,
      }] : []),
      {
        '@type': 'ListItem',
        position: product.category ? 4 : 3,
        name: product.title || product.name || 'Product',
      },
    ],
  } : null;

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <ProductDetailPage productId={id} initialProduct={product} />
    </>
  );
}

export async function generateStaticParams() {
  return [{ id: '1' }];
}
