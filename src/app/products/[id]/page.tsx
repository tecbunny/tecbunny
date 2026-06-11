import { ProductDetailPage } from '@/components/products/ProductDetailPage';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { cleanMetadataDescription, cleanMetadataTitle, createPageMetadata } from '@/lib/metadata';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { createSupabaseClient as createPublicSupabaseClient } from '@/lib/supabase-server';
import { BRAND_LOGO_URL } from '@/components/ui/logo';
import { stripHtmlToPlainText } from '@/lib/strings';
import { isPubliclyVisibleProduct } from '@/lib/product-visibility';
import { notFound } from 'next/navigation';

// ISR: revalidate every 5 minutes — dramatically reduces TTFB on product pages
export const revalidate = 300;
// Using dynamic rendering to support cookie-based source-aware pricing without hydration flashes
export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

async function getCatalogClient() {
  return isSupabaseServiceConfigured ? createServiceClient() : createPublicSupabaseClient();
}

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await getCatalogClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();

  if (!product || !isPubliclyVisibleProduct(product)) {
    return createPageMetadata({
      title: 'Product Not Found',
      description: 'The requested product could not be found.',
      path: `/products/${id}`,
    });
  }

  const title = cleanMetadataTitle(product.title || product.name || product.sku, 'Premium Product');

  // 3. HEADLESS SEO META-PROPAGATION
  // Programmatically parse technical specs for optimized meta-density
  const specs = product.specifications ? Object.entries(product.specifications as Record<string, string>)
    .map(([k, v]) => `${k}: ${v}`).join(', ') : '';

  const plainDesc = cleanMetadataDescription(
    `${product.seo_description || product.description || product.details} Technical Specs: ${specs}`,
    `Buy ${title} at TecBunny. Professional hardware with guaranteed SLA and stock availability.`,
  );

  return createPageMetadata({
    title: `${title} | Professional Grade B2B Surveillance`,
    description: plainDesc.substring(0, 160),
    path: `/products/${id}`,
    image: product.image || product.image_url || BRAND_LOGO_URL,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sourceCookie = cookieStore.get('tb_source_context')?.value;

  let sourceContext = null;
  if (sourceCookie) {
    try {
      sourceContext = JSON.parse(Buffer.from(sourceCookie, 'base64').toString());
    } catch (e) {
      console.error('Failed to parse source context', e);
    }
  }

  const supabase = await getCatalogClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();

  if (!product || !isPubliclyVisibleProduct(product)) {
    notFound();
  }

  const siteUrl = 'https://www.tecbunny.com';
  const productTitle = cleanMetadataTitle(product.title || product.name || product.sku, 'Premium Product');
  const productCategory = stripHtmlToPlainText(product.category, 80);
  const productDescription = stripHtmlToPlainText(product.description || product.details, 500) ||
    `Quality ${productCategory || 'technology'} hardware available at TecBunny.`;
  const productImage = product.image || product.image_url || BRAND_LOGO_URL;
  const productPrice = Number(product.price ?? product.offer_price ?? 0);

  // Product JSON-LD — full schema with Offer, shippingDetails, seller reference
  const productJsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${siteUrl}/products/${id}#product`,
    name: productTitle,
    sku: product.sku || product.handle || id,
    ...(product.model_number ? { mpn: product.model_number } : {}),
    brand: {
      '@type': 'Brand',
      name: product.brand || 'TecBunny',
    },
    ...(productCategory ? { category: productCategory } : {}),
    description: productDescription,
    image: [
      productImage,
    ].filter(Boolean),
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/products/${id}`,
      priceCurrency: 'INR',
      price: Number.isFinite(productPrice) ? String(productPrice) : '0',
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
      ...(productCategory ? [{
        '@type': 'ListItem',
        position: 3,
        name: productCategory,
        item: `${siteUrl}/products?category=${encodeURIComponent(productCategory)}`,
      }] : []),
      {
        '@type': 'ListItem',
        position: productCategory ? 4 : 3,
        name: productTitle,
      },
    ],
  } : null;

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        />
      )}
      <ProductDetailPage 
        productId={id} 
        initialProduct={product} 
        sourceContext={sourceContext}
      />
    </>
  );
}


