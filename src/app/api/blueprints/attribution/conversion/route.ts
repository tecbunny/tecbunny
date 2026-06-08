import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Background query rule to trigger creator milestones
 * POST /api/blueprints/attribution/conversion
 */
export async function POST(request: NextRequest) {
  try {
    const { parentBlueprintId, newOrderId } = await request.json();

    if (!parentBlueprintId || !newOrderId) {
      return NextResponse.json({ error: 'Missing attribution context' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Fetch the original creator's profile
    const { data: blueprint, error: blueprintError } = await supabase
      .from('published_blueprints')
      .select('creator_id')
      .eq('id', parentBlueprintId)
      .single();

    if (blueprintError || !blueprint) {
      return NextResponse.json({ error: 'Parent blueprint not found' }, { status: 404 });
    }

    // 2. Log a milestone for the creator
    // This would typically involve adding a record to a notifications or milestones table
    const { error: milestoneError } = await supabase
      .from('user_milestones')
      .insert([{
        user_id: blueprint.creator_id,
        type: 'viral_conversion',
        metadata: {
          blueprint_id: parentBlueprintId,
          order_id: newOrderId,
          message: 'Success! Someone just placed an order using your shared blueprint.'
        }
      }]);

    if (milestoneError) throw milestoneError;

    logger.info('viral_milestone_triggered', { 
      creatorId: blueprint.creator_id, 
      parentId: parentBlueprintId, 
      newOrderId 
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    logger.error('failed_to_process_viral_milestone', { error: error.message });
    return NextResponse.json({ error: 'Internal failure' }, { status: 500 });
  }
}
