/**
 * Image utilities for validating and filtering product images
 */

/**
 * Normalize image URLs, including Supabase Storage paths.
 */
export function normalizeImageUrl(url: any): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('http') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return trimmed;
  }

  const looksLikeFile = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(trimmed) || trimmed.includes('/');
  if (!looksLikeFile) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const safePath = trimmed.replace(/^\/+/, '');
    return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/images/${safePath}`;
  }

  return trimmed;
}

/**
 * Checks if an image URL is valid and not a placeholder/empty string
 */
export function isValidImageUrl(url: any): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  
  // Check for minimum length and common invalid values
  if (trimmed.length < 5 || 
      trimmed === 'null' || 
      trimmed === 'undefined' || 
      trimmed === '' ||
      trimmed === 'N/A' ||
      trimmed === 'null.jpg' ||
      trimmed === 'undefined.jpg') {
    return false;
  }
  
  // Avoid SVG placeholders which might not render well
  if (trimmed.startsWith('data:image/svg')) {
    return false;
  }
  
  // Check for placeholder services and invalid URLs
  if (trimmed.includes('placehold.co') ||
      trimmed.includes('placeholder.com') ||
      trimmed.includes('via.placeholder.com') ||
      trimmed.includes('placeholder') ||
      trimmed.includes('example.com') ||
      trimmed.includes('your-domain.com') ||
      trimmed.includes('cdn.your-domain.com')) {
    return false;
  }
  
    // Check for valid URL patterns or relative paths/filenames
    return trimmed.startsWith('http') ||
      trimmed.startsWith('/') ||
      trimmed.startsWith('./') ||
      trimmed.startsWith('../') ||
      (/\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(trimmed) && !trimmed.startsWith(' ')) ||
      (trimmed.includes('/') && !trimmed.startsWith(' '));
  }

/**
 * Gets the first valid image from an array of images
 */
export function getFirstValidImage(imageArray: any[]): string | null {
  if (!Array.isArray(imageArray)) return null;
  
  for (const img of imageArray) {
    const url = typeof img === 'string' ? img : img?.url || '';
    const normalized = normalizeImageUrl(url);
    if (normalized && isValidImageUrl(normalized)) {
      return normalized;
    }
  }
  return null;
}

/**
 * Filters an array to only include valid image URLs
 */
export function filterValidImages(imageArray: any[]): string[] {
  if (!Array.isArray(imageArray)) return [];
  
  return imageArray
    .map(img => typeof img === 'string' ? img : img?.url || '')
    .map(normalizeImageUrl)
    .filter((value): value is string => Boolean(value))
    .filter(isValidImageUrl);
}

/**
 * Gets the primary display image for a product, checking all possible sources
 */
export function getProductDisplayImage(product: any, _options: {
  fallbackText?: string;
  fallbackSize?: string;
} = {}): string | null {
  const primaryCandidates = [
    product?.image,
    product?.image_url,
    product?.imageUrl,
    product?.primary_image,
  ];

  for (const candidate of primaryCandidates) {
    const normalized = normalizeImageUrl(candidate);
    if (normalized && isValidImageUrl(normalized)) {
      return normalized;
    }
  }

  if (typeof product?.image_urls === 'string') {
    const firstFromCsv = product.image_urls
      .split(',')
      .map((value: string) => value.trim())
      .find(Boolean);
    const normalized = normalizeImageUrl(firstFromCsv);
    if (normalized && isValidImageUrl(normalized)) {
      return normalized;
    }
  }
  
  // Try to get first valid image from images array
  const firstFromImages = getFirstValidImage(product?.images || []);
  if (firstFromImages) return firstFromImages;
  
  // Try to get first valid image from additional_images array
  const firstFromAdditional = getFirstValidImage(product?.additional_images || []);
  if (firstFromAdditional) return firstFromAdditional;
  
  // Return null if no valid images found - let the component handle the fallback
  return null;
}

/**
 * Gets all valid images for a product from all sources
 */
export function getAllProductImages(product: any): string[] {
  const images: string[] = [];
  
  // Add main image if valid
  if (isValidImageUrl(product?.image)) {
    images.push(product.image);
  }
  
  // Add valid images from images array
  const validImages = filterValidImages(product?.images || []);
  images.push(...validImages);
  
  // Add valid images from additional_images array
  const validAdditionalImages = filterValidImages(product?.additional_images || []);
  images.push(...validAdditionalImages);
  
  // Remove duplicates
  return [...new Set(images)];
}

/**
 * Cleans up product data by removing invalid images
 */
export function cleanupProductImages(product: any): any {
  const cleaned = { ...product };
  
  // Clean main image
  if (!isValidImageUrl(cleaned.image)) {
    cleaned.image = null;
  }
  
  // Clean images array
  if (Array.isArray(cleaned.images)) {
    cleaned.images = filterValidImages(cleaned.images);
    if (cleaned.images.length === 0) {
      cleaned.images = null;
    }
  }
  
  // Clean additional_images array
  if (Array.isArray(cleaned.additional_images)) {
    cleaned.additional_images = filterValidImages(cleaned.additional_images);
    if (cleaned.additional_images.length === 0) {
      cleaned.additional_images = null;
    }
  }
  
  return cleaned;
}