import { NextResponse } from 'next/server';

import { requireAdminContext } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

// export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const { serviceSupabase } = await requireAdminContext();

    const { data, error } = await serviceSupabase
      .from('services')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('admin_services_fetch_failed', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
    }

    return NextResponse.json({ services: data ?? [] });
  } catch (error) {
    logger.error('admin_services_fetch_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
