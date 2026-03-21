import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '../../../../lib/supabase/client';
import { logger } from '../../../../lib/logger';

export async function DELETE(_request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Delete all products with Coconut brand or containing coconut in name/title
    const { data, error } = await supabase
      .from('products')
      .delete()
      .or('brand.eq.Coconut,name.ilike.%coconut%,title.ilike.%coconut%,name.ilike.%coco%,title.ilike.%coco%')
      .select();

    if (error) {
      logger.error('products_cleanup_delete_error', { error });
      return NextResponse.json(
        { error: 'Failed to delete products', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${data?.length || 0} products`,
      deleted: data?.length || 0
    });

  } catch (error) {
    logger.error('products_cleanup_unhandled', { error });
    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
