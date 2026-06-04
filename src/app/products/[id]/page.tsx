import { ProductDetailPage } from '@/components/products/ProductDetailPage';
import { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
import { createClient } from '@/lib/supabase/server';
import { BRAND_LOGO_URL } from '@/components/ui/logo';

// ISR: revalidate every 5 minutes — dramatically reduces TTFB on product pages
export const revalidate = 300;

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

/** Strip HTML tags and collapse whitespace for safe use in meta tags */
function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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

  // Bug fix #2: null-safe title fallback
  const title = product.title || product.name || product.sku || 'Product';

  // Bug fix #1: strip HTML from description before using in meta tags
  const rawDesc = product.description || product.details || '';
  const plainDesc = stripHtml(rawDesc).slice(0, 160) ||
    `Buy ${title} at TecBunny. CCTV, IT and automation hardware in Goa.`;

  return createPageMetadata({
    title: `${title} | TecBunny`,
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
    description: stripHtml(product.description || product.details).slice(0, 500) ||
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
      <ProductDetailPage productId={id} />
    </>
  );
}

export async function generateStaticParams() {
  return [{ id: '1' }];
}
