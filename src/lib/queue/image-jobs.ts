import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { createServiceClient, isSupabaseServiceConfigured } from '../supabase/server';
import { logger } from '../logger';
import { isValidImageUrl } from '../image-utils';

import pLimit from 'p-limit';

const redisUrl = process.env.REDIS_URL;

export let imageJobsQueue: any;
export let imageWorker: any = null;

async function processCleanupJob(job: Job) {
  const correlationId = job.data.correlationId || `cleanup-${Date.now()}`;
  logger.info('worker_product_image_cleanup_start', { correlationId, jobId: job.id });

  const supabase = createServiceClient();
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, handle, title, image, images, additional_images');

  if (fetchError) {
    throw new Error(`Failed to fetch products: ${fetchError.message}`);
  }

  let updatedCount = 0;
  let cleanedImages = 0;
  const cleanupResults: any[] = [];

  const limit = pLimit(10);

  const cleanupTasks = (products || []).map((product) => limit(async () => {
    let needsUpdate = false;
    const cleanupInfo: any = {
      id: product.id,
      handle: product.handle,
      title: product.title,
      changes: []
    };

    if (product.image && !isValidImageUrl(product.image)) {
      cleanupInfo.changes.push(`Removed invalid main image: "${product.image}"`);
      product.image = null;
      needsUpdate = true;
      cleanedImages++;
    }

    if (Array.isArray(product.images)) {
      const validImages = product.images.filter((img: any) => {
        const url = typeof img === 'string' ? img : img?.url || '';
        return isValidImageUrl(url);
      });
      if (validImages.length !== product.images.length) {
        const removedCount = product.images.length - validImages.length;
        cleanupInfo.changes.push(`Removed ${removedCount} invalid images from images array`);
        product.images = validImages.length > 0 ? validImages : null;
        needsUpdate = true;
        cleanedImages += removedCount;
      }
    }

    if (Array.isArray(product.additional_images)) {
      const validAdditionalImages = product.additional_images.filter((img: any) => {
        const url = typeof img === 'string' ? img : img?.url || '';
        return isValidImageUrl(url);
      });
      if (validAdditionalImages.length !== product.additional_images.length) {
        const removedCount = product.additional_images.length - validAdditionalImages.length;
        cleanupInfo.changes.push(`Removed ${removedCount} invalid images from additional_images array`);
        product.additional_images = validAdditionalImages.length > 0 ? validAdditionalImages : null;
        needsUpdate = true;
        cleanedImages += removedCount;
      }
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          image: product.image,
          images: product.images,
          additional_images: product.additional_images
        })
        .eq('id', product.id);

      if (updateError) {
        cleanupInfo.error = updateError.message;
      } else {
        updatedCount++;
      }
    }

    if (needsUpdate || cleanupInfo.error) {
      cleanupResults.push(cleanupInfo);
    }
  }));

  await Promise.all(cleanupTasks);

  return {
    totalProducts: products?.length || 0,
    updatedProducts: updatedCount,
    cleanedImages,
    details: cleanupResults
  };
}

async function processFixImagesJob(job: Job) {
  const { dryRun = true } = job.data;
  logger.info('worker_fix_images_start', { jobId: job.id, dryRun });

  const supabase = createServiceClient();
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, title, name, image, category, product_type')
    .or('image.is.null,image.eq.')
    .limit(100);

  if (fetchError) {
    throw new Error(`Failed to fetch products: ${fetchError.message}`);
  }

  if (!products || products.length === 0) {
    return { success: true, message: 'No products need image fixes', updated: 0 };
  }

  const categoryImages: Record<string, string> = {
    'CCTV': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&h=400&fit=crop',
    'Camera': 'https://images.unsplash.com/photo-1520390138845-fd2d229dd553?w=600&h=400&fit=crop',
    'DVR': 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&h=400&fit=crop',
    'NVR': 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&h=400&fit=crop',
    'Security': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&h=400&fit=crop',
    'Surveillance': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&h=400&fit=crop',
    'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&h=400&fit=crop',
    'default': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop'
  };

  const updates: any[] = [];
  const previews: any[] = [];

  for (const product of products) {
    const category = product.category || product.product_type || 'default';
    const productName = product.title || product.name || 'Product';
    
    let imageUrl = categoryImages['default'];
    for (const [key, url] of Object.entries(categoryImages)) {
      if (category.toLowerCase().includes(key.toLowerCase())) {
        imageUrl = url;
        break;
      }
    }

    previews.push({
      id: product.id,
      name: productName,
      category,
      currentImage: product.image || 'none',
      newImage: imageUrl
    });

    if (!dryRun) {
      updates.push({ id: product.id, image: imageUrl });
    }
  }

  let updateCount = 0;
  if (!dryRun && updates.length > 0) {
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ image: update.image })
        .eq('id', update.id);
      if (!updateError) {
        updateCount++;
      }
    }
  }

  return {
    success: true,
    dryRun,
    totalFound: products.length,
    updated: updateCount,
    previews: previews.slice(0, 10)
  };
}

if (redisUrl) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false }) as any;
  connection.on('error', (err: any) => {
    logger.warn('redis_queue_connection_error', { error: err.message });
  });

  imageJobsQueue = new Queue('image-jobs', { connection });

  imageWorker = new Worker('image-jobs', async (job: Job) => {
    if (job.name === 'cleanup-images') {
      return await processCleanupJob(job);
    } else if (job.name === 'fix-images') {
      return await processFixImagesJob(job);
    } else {
      throw new Error(`Unknown job name: ${job.name}`);
    }
  }, { connection });

  imageWorker.on('completed', (job: Job, returnvalue: any) => {
    logger.info(`Job ${job.id} completed!`, { returnvalue });
  });

  imageWorker.on('failed', (job: Job | undefined, error: Error) => {
    logger.error(`Job ${job?.id} failed`, { error: error.message });
  });
} else {
  imageJobsQueue = {
    add: async (name: string, data?: any) => {
      logger.error('redis_queue_not_configured', { jobName: name });
      throw new Error('Redis connection not configured. Background jobs cannot be queued.');
    },
    getJob: async (id: string) => {
      logger.error('redis_queue_not_configured', { jobId: id });
      throw new Error('Redis connection not configured. Background jobs cannot be queried.');
    }
  };
}
