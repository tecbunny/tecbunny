import dns from 'dns/promises';

import { NextRequest } from 'next/server';

import { apiSuccess, apiError } from '../../../lib/errors';
import { uploadProductImage, uploadToSupabase } from '../../../lib/supabase-storage';
import { uploadHeroBanner, isS3Configured } from '../../../lib/s3-storage';
import { logger } from '../../../lib/logger';
import { createClient } from '../../../lib/supabase/server';
import { requireAdmin } from '../../../lib/admin-auth';

export async function POST(request: NextRequest) {
  const correlationId = `upload-url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Security: Admin Only
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { isAdmin, error: authError } = await requireAdmin(user, supabase);
    if (!isAdmin) {
      return apiError('UNAUTHORIZED', { correlationId, overrideMessage: authError });
    }

    logger.info('upload_from_url_start', { correlationId });
    
    const { url, type = 'product' } = await request.json();
    
    if (!url) {
      logger.warn('upload_from_url_no_url', { correlationId });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'No URL provided', correlationId });
    }
    
    // Validate URL format
    let imageUrl: URL;
    try {
      imageUrl = new URL(url);
    } catch {
      logger.warn('upload_from_url_invalid_url', { correlationId, url });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid URL format', correlationId });
    }

    // SSRF Protection: Resolve DNS and check for private IPs
    try {
      const hostname = imageUrl.hostname;
      const addresses = await dns.resolve(hostname);
      for (const ip of addresses) {
        // Simple check for private ranges (10.x, 192.168.x, 172.16-31.x, 127.x)
        if (
          ip.startsWith('10.') || 
          ip.startsWith('192.168.') || 
          ip.startsWith('127.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
        ) {
           logger.warn('upload_from_url_ssrf_attempt', { correlationId, url, ip });
           return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid URL target', correlationId });
        }
      }
    } catch (dnsError) {
       // If DNS fails, we can't verify, so we block
       logger.warn('upload_from_url_dns_fail', { correlationId, url });
       return apiError('VALIDATION_ERROR', { overrideMessage: 'Could not resolve URL', correlationId });
    }
    
    // Check if URL points to an image
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const urlPath = imageUrl.pathname.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => urlPath.includes(ext));
    
    if (!hasValidExtension && !url.startsWith('data:image/')) {
      logger.warn('upload_from_url_invalid_image', { correlationId, url: urlPath });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'URL does not appear to be an image', correlationId });
    }
    
    logger.debug('upload_from_url_fetching', { correlationId, url: imageUrl.href });
    
    // Fetch the image from the URL
    const response = await fetch(imageUrl.href, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      logger.warn('upload_from_url_fetch_failed', { correlationId, status: response.status, url: imageUrl.href });
      return apiError('EXTERNAL_ERROR', { overrideMessage: 'Failed to fetch image from URL', correlationId });
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      logger.warn('upload_from_url_invalid_content_type', { correlationId, contentType, url: imageUrl.href });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'URL does not serve an image', correlationId });
    }
    
    // Get the image data as a buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Validate file size (4MB max)
    if (buffer.length > 4 * 1024 * 1024) {
      logger.warn('upload_from_url_too_large', { correlationId, size: buffer.length });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Image is too large (max 4MB)', correlationId });
    }
    
    logger.info('upload_from_url_validation_passed', { correlationId, size: buffer.length, contentType });
    
    // Upload to storage based on type
    let result;
    
    switch (type) {
      case 'product':
        logger.debug('upload_from_url_variant', { correlationId, variant: 'product' });
        result = await uploadProductImage(buffer);
        break;
      case 'hero':
        logger.debug('upload_from_url_variant', { correlationId, variant: 'hero' });
        if (isS3Configured) {
          result = await uploadHeroBanner(buffer as any, 'hero-banners');
        } else {
          result = await uploadToSupabase(buffer, 'hero-banners', { publicAccess: true });
        }
        break;
      default:
        logger.debug('upload_from_url_variant', { correlationId, variant: 'general' });
        result = await uploadProductImage(buffer);
    }
    
    logger.info('upload_from_url_success', { 
      correlationId, 
      publicId: result.public_id, 
      format: result.format, 
      width: result.width, 
      height: result.height,
      originalUrl: imageUrl.href
    });
    
    return apiSuccess({
      secure_url: result.secure_url,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      originalUrl: imageUrl.href
    }, correlationId);
    
  } catch (error) {
    logger.error('upload_from_url_error', {
      correlationId,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
