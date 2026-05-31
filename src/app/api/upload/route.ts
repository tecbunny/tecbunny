import { NextRequest } from 'next/server';

import {
  createClient as createServerClient,
  isSupabaseServiceConfigured
} from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { requireAdmin } from '@/lib/admin-auth';

// Ensure Node.js runtime for streaming uploads
export const runtime = 'nodejs';
// Allow more time for larger uploads on serverless
export const maxDuration = 60;
import { uploadToSupabase, uploadFavicon, uploadLogo, uploadProductImage } from '@/lib/supabase-storage';
import { uploadHeroBanner, isS3Configured } from '@/lib/s3-storage';

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id');
  try {
    // Allow server uploads if either Supabase service role OR S3 is configured.
    if (!isS3Configured && !isSupabaseServiceConfigured) {
      logger.warn('upload_supabase_not_configured', {
        correlationId,
        missingServiceConfig: !isSupabaseServiceConfigured,
        missingS3Config: !isS3Configured
      });
      return apiError('SERVICE_UNAVAILABLE', {
        overrideMessage: 'File uploads are temporarily unavailable',
        correlationId
      });
    }

    logger.info('upload_start', {
      correlationId,
      headers: {
        'content-type': request.headers.get('content-type'),
        'content-length': request.headers.get('content-length')
      }
    });
    
    // Auth check
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { isAdmin, error: authError } = await requireAdmin(user, supabase);
    if (!isAdmin) {
      logger.warn('upload_unauthorized', { correlationId, user: user?.id, error: authError });
      return apiError('UNAUTHORIZED', { correlationId, overrideMessage: authError });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    // Allow clients to suggest a folder/path (for hero carousel management)
    const pathParam = formData.get('path') as string | null;

    logger.debug('upload_file_received', {
      correlationId,
      fileMeta: { name: file?.name, size: file?.size, type: file?.type },
      uploadType: type
    });

    if (!file) {
      logger.warn('upload_no_file', { correlationId });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'No file provided', correlationId });
    }

    // Validate file type by declared MIME
    if (!file.type.startsWith('image/')) {
      logger.warn('upload_invalid_mime', { correlationId, mime: file.type });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'File must be an image', correlationId });
    }

    // Validate file size (4MB max to stay under serverless limits)
  if (file.size > 4 * 1024 * 1024) {
      logger.warn('upload_file_too_large', { correlationId, size: file.size });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'File size must be less than 4MB', correlationId });
    }

    // Magic bytes validation (PNG/JPEG/WebP/GIF)
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    const isJpeg = head[0] === 0xff && head[1] === 0xd8;
    const isWebp = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46; // RIFF
    const isGif = head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46; // GIF
    if (!(isPng || isJpeg || isWebp || isGif)) {
      logger.warn('upload_invalid_magic_bytes', { correlationId, head: Array.from(head.slice(0,8)) });
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid image file', correlationId });
    }
    logger.info('upload_validation_passed', { correlationId, mime: file.type, size: file.size });

    let result;

    // Upload based on type
    switch (type) {
      case 'favicon':
        logger.debug('upload_variant', { correlationId, variant: 'favicon' });
        result = await uploadFavicon(file); break;
      case 'logo':
        logger.debug('upload_variant', { correlationId, variant: 'logo' });
        result = await uploadLogo(file); break;
      case 'product':
        logger.debug('upload_variant', { correlationId, variant: 'product' });
        result = await uploadProductImage(file); break;
      case 'hero':
        logger.debug('upload_variant', { correlationId, variant: 'hero', pathParam });
        if (isS3Configured) {
          // Use S3 helper when available
          result = await uploadHeroBanner(file, pathParam || 'hero-banners');
        } else {
          // Fallback to Supabase storage for environments without S3
          logger.debug('upload_variant_hero_fallback_supabase', { correlationId, folder: pathParam || 'hero-banners' });
          result = await uploadToSupabase(file, pathParam || 'hero-banners', { publicAccess: true });
        }
        break;
      default:
        logger.debug('upload_variant', { correlationId, variant: 'general' });
        result = await uploadToSupabase(file);
    }

    if (!result || (!result.secure_url && !result.url)) {
      logger.error('upload_no_url_returned', { correlationId, result });
      return apiError('INTERNAL_ERROR', { overrideMessage: 'Upload completed but no URL returned by storage provider', correlationId });
    }
    logger.info('upload_success', { correlationId, publicId: result.public_id, format: result.format, width: result.width, height: result.height });
    return apiSuccess({
      secure_url: result.secure_url,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    }, correlationId);

  } catch (error) {
    logger.error('upload_error', {
      correlationId,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error
    });
    return apiError('INTERNAL_ERROR', { overrideMessage: 'Failed to upload image', correlationId });
  }
}
