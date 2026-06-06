import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';
import { imageJobsQueue } from '@/lib/queue/image-jobs';

function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin) return true;
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

    // Require admin authorization
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const { isAdmin, error: authError, status } = await requireAdmin(user, supabaseAuth);
    if (!isAdmin) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: status || 403 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      logger.warn('Failed to parse fix-images request body', { error: e });
    }
    const dryRun = (body as any).dryRun !== false;

    // Enqueue the job
    const job = await imageJobsQueue.add('fix-images', { dryRun });

    logger.info('fix_images_job_enqueued', { jobId: job.id, dryRun });

    return NextResponse.json({
      success: true,
      message: 'Fix images job enqueued successfully',
      jobId: job.id,
      dryRun,
      statusEndpoint: `/api/admin/jobs/${job.id}`
    }, { status: 202 });

  } catch (error: any) {
    logger.error('fix_images_queue_error', { error: error?.message });
    return NextResponse.json(
      { error: 'Failed to enqueue fix images job', details: error?.message },
      { status: 500 }
    );
  }
}
