import { NextRequest, NextResponse } from 'next/server';

import { getSessionWithRole } from '@/lib/auth/server-role';
import { logger } from '@/lib/logger';
import { imageJobsQueue } from '@/lib/queue/image-jobs';

const ADMIN_ROLES = new Set(['admin', 'manager', 'superadmin']);

function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin) return true; // Same-origin requests might not have origin header
  try {
    const originUrl = new URL(origin);
    if (host && originUrl.host === host) return true;
    if (originUrl.hostname === 'localhost' || originUrl.hostname.endsWith('tecbunny.com')) return true;
  } catch (e) {
    return false;
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const correlationId = `cleanup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get session and check permissions
    const { role, session } = await getSessionWithRole(request);
    
    if (!session?.user || !role || !ADMIN_ROLES.has(role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Enqueue the job instead of processing it synchronously
    const job = await imageJobsQueue.add('cleanup-images', { correlationId });

    logger.info('product_image_cleanup_enqueued', { jobId: job.id, correlationId });

    return NextResponse.json({
      success: true,
      message: 'Image cleanup job enqueued successfully',
      jobId: job.id,
      statusEndpoint: `/api/admin/jobs/${job.id}`
    }, { status: 202 });

  } catch (error) {
    logger.error('product_image_cleanup_queue_error', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
