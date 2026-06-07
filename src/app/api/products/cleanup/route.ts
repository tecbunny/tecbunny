import { NextRequest, NextResponse } from 'next/server';

import { AdminAuthError, requireAdminContext } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

export async function DELETE(_request: NextRequest) {
  try {
    const { serviceSupabase, user, role } = await requireAdminContext();

    const { data: candidates, error: selectError } = await serviceSupabase
      .from('products')
      .select('id')
      .or('brand.eq.Coconut,name.ilike.%coconut%,title.ilike.%coconut%,name.ilike.%coco%,title.ilike.%coco%')
      .order('updated_at', { ascending: true, nullsFirst: true })
      .limit(50);

    if (selectError) {
      logger.error('products_cleanup_select_error', { error: selectError.message, code: selectError.code });
      return NextResponse.json(
        { error: 'Failed to load cleanup candidates', details: selectError.message },
        { status: 500 }
      );
    }

    const candidateIds = (candidates ?? []).map((candidate) => candidate.id).filter(Boolean);

    if (candidateIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matching products found',
        deleted: 0
      });
    }

    const { data, error } = await serviceSupabase
      .from('products')
      .delete()
      .in('id', candidateIds)
      .select();

    if (error) {
      logger.error('products_cleanup_delete_error', { error: error.message, code: error.code });
      return NextResponse.json(
        { error: 'Failed to delete products', details: error.message },
        { status: 500 }
      );
    }

    logger.info('products_cleanup_batch_deleted', {
      deleted: data?.length || 0,
      requestedBy: user.id,
      role,
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${data?.length || 0} products`,
      deleted: data?.length || 0
    });

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logger.error('products_cleanup_unhandled', { error });
    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
