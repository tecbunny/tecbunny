
import * as React from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';

import type { Product, Review } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StarRating } from '@/components/products/StarRating';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { WishlistButton } from '@/components/wishlist/WishlistButton';
import { ProductRecommendations } from '@/components/products/ProductRecommendations';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

async function getProduct(id: string) {
  const supabase = createClient();
  const { data: product, error } = await supabase
  
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !product) {
    notFound();
  }

  const firstImage = Array.isArray((product as any).images) && (product as any).images.length > 0
    ? (typeof (product as any).images[0] === 'string'
        ? (product as any).images[0]
        : (product as any).images[0]?.url || '')
    : undefined;

  return {
    ...product,
    id: product.id,
    name: (product as any).name || product.title || 'Product',
    title: product.title || (product as any).name || 'Product',
    category: (product as any).category || product.product_type || 'General',
    brand: (product as any).brand || product.vendor,
    price: typeof product.price === 'number' ? product.price : Number(product.price) || 0,
    popularity: (product as any).popularity || 0,
    rating: (product as any).rating || 0,
    reviewCount: (product as any).review_count ?? (product as any).reviewCount ?? 0,
    description: product.description || 'No description available',
    image: (product as any).image || firstImage || 'https://placehold.co/600x400.png?text=No+Image',
    created_at: product.created_at || new Date().toISOString(),
    updated_at: product.updated_at,
  } as Product;
}

async function getReviews(productId: string) {
  const supabase = createClient();
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId);
  return (reviews || []) as Review[];
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  const reviews = await getReviews(params.id);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid md:grid-cols-2 gap-12 items-start">
        <Card className="overflow-hidden">
          <div className="aspect-square relative w-full">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
                data-ai-hint={`${product.category} product`}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-600 text-8xl font-bold">
                {product.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <div>
            <Badge variant="secondary" className="mb-2">{product.category}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-primary">{product.name}</h1>
            <div className="mt-3 flex items-center gap-4">
                <StarRating rating={product.rating} size={20} />
                <span className="text-muted-foreground">{product.reviewCount} reviews</span>
            </div>
          </div>

          <p className="text-lg text-foreground/80">{product.description}</p>
          
          <div className="flex items-center gap-4">
             <span className="text-4xl font-bold text-primary">₹{product.price.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-4">
            <AddToCartButton product={product} />
            <WishlistButton product={product} />
          </div>

          <Separator />

          <div>
             <h3 className="text-xl font-semibold mb-4">Customer Reviews</h3>
             <div className="space-y-6">
                 {reviews.length > 0 ? reviews.map(review => (
                     <Card key={review.id}>
                         <CardHeader>
                            <div className="flex items-center justify-between">
                                 <p className="font-semibold">{review.author}</p>
                                 <p className="text-sm text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p>
                            </div>
                            <StarRating rating={review.rating} />
                         </CardHeader>
                         <CardContent>
                            <p className="text-foreground/90">{review.comment}</p>
                         </CardContent>
                     </Card>
                 )) : <p className="text-muted-foreground">No reviews yet.</p>}
             </div>
          </div>
        </div>
      </div>
      <Separator className="my-12" />
      <ProductRecommendations currentProductId={product.id} />
    </div>
  );
}
