import dns from 'dns/promises';
import net from 'net';

import { NextRequest } from 'next/server';

import { apiSuccess, apiError } from '@/lib/errors';
import { uploadProductImage, uploadToSupabase } from '@/lib/supabase-storage';
import { uploadHeroBanner, isS3Configured } from '@/lib/s3-storage';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

const MAX_REMOTE_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_REMOTE_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

function isBlockedIPv4(ip: string) {
  const octets = ip.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [first, second] = octets;
  return first === 0
    || first === 10
    || first === 127
    || first === 169 && second === 254
    || first === 172 && second >= 16 && second <= 31
    || first === 192 && second === 168
    || first === 100 && second >= 64 && second <= 127
    || first >= 224;
}

function isBlockedIPv6(ip: string) {
  const normalized = ip.toLowerCase();
  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
    || normalized.startsWith('ff');
}

function isBlockedIp(ip: string) {
  const version = net.isIP(ip);
  if (version === 4) return isBlockedIPv4(ip);
  if (version === 6) return isBlockedIPv6(ip);
  return true;
}

async function validatePublicRemoteUrl(url: URL) {
  if (!ALLOWED_REMOTE_IMAGE_PROTOCOLS.has(url.protocol)) {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  const hostname = url.hostname;
  if (!hostname) {
    return false;
  }

  const literalIpVersion = net.isIP(hostname);
  if (literalIpVersion && isBlockedIp(hostname)) {
    return false;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.length > 0 && records.every((record) => !isBlockedIp(record.address));
}

async function readResponseWithLimit(response: Response, limitBytes: number) {
  if (!response.body) {
    return Buffer.from(await response.arrayBuffer());
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limitBytes) {
      await reader.cancel();
      throw new Error('REMOTE_IMAGE_TOO_LARGE');
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

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

    if (!ALLOWED_REMOTE_IMAGE_PROTOCOLS.has(imageUrl.protocol)) {
      logger.warn('upload_from_url_invalid_protocol', { correlationId, protocol: imageUrl.protocol });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'URL must use http or https', correlationId });
    }

    // SSRF Protection: Resolve DNS and check for private, loopback, link-local, and multicast ranges.
    try {
      const isPublicTarget = await validatePublicRemoteUrl(imageUrl);
      if (!isPublicTarget) {
        logger.warn('upload_from_url_ssrf_attempt', { correlationId, url });
        return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid URL target', correlationId });
      }
    } catch (_dnsError) {
       // If DNS fails, we can't verify, so we block
       logger.warn('upload_from_url_dns_fail', { correlationId, url });
       return apiError('VALIDATION_ERROR', { overrideMessage: 'Could not resolve URL', correlationId });
    }
    
    // Check if URL points to an image
    const urlPath = imageUrl.pathname.toLowerCase();
    const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.some(ext => urlPath.endsWith(ext));
    
    if (!hasValidExtension) {
      logger.warn('upload_from_url_invalid_image', { correlationId, url: urlPath });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'URL does not appear to be an image', correlationId });
    }
    
    logger.debug('upload_from_url_fetching', { correlationId, url: imageUrl.href });
    
    // Fetch the image from the URL
    const response = await fetch(imageUrl.href, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.status >= 300 && response.status < 400) {
      logger.warn('upload_from_url_redirect_blocked', { correlationId, status: response.status, url: imageUrl.href });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Redirecting image URLs are not allowed', correlationId });
    }
    
    if (!response.ok) {
      logger.warn('upload_from_url_fetch_failed', { correlationId, status: response.status, url: imageUrl.href });
      return apiError('EXTERNAL_ERROR', { overrideMessage: 'Failed to fetch image from URL', correlationId });
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      logger.warn('upload_from_url_invalid_content_type', { correlationId, contentType, url: imageUrl.href });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'URL does not serve an image', correlationId });
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REMOTE_IMAGE_BYTES) {
      logger.warn('upload_from_url_too_large_header', { correlationId, size: contentLength });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Image is too large (max 4MB)', correlationId });
    }
    
    // Get the image data as a buffer
    let buffer: Buffer;
    try {
      buffer = await readResponseWithLimit(response, MAX_REMOTE_IMAGE_BYTES);
    } catch (readError) {
      if (readError instanceof Error && readError.message === 'REMOTE_IMAGE_TOO_LARGE') {
        logger.warn('upload_from_url_too_large_stream', { correlationId });
        return apiError('VALIDATION_ERROR', { overrideMessage: 'Image is too large (max 4MB)', correlationId });
      }
      throw readError;
    }
    
    // Validate file size (4MB max)
    if (buffer.length > MAX_REMOTE_IMAGE_BYTES) {
      logger.warn('upload_from_url_too_large', { correlationId, size: buffer.length });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Image is too large (max 4MB)', correlationId });
    }
    
    // Magic bytes validation
    const head = new Uint8Array(buffer.subarray(0, 16));
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    const isJpeg = head[0] === 0xff && head[1] === 0xd8;
    const isWebp = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46; // RIFF
    const isGif = head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46; // GIF
    if (!(isPng || isJpeg || isWebp || isGif)) {
      logger.warn('upload_from_url_invalid_magic_bytes', { correlationId, head: Array.from(head.subarray(0,8)) });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid image file signature', correlationId });
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
