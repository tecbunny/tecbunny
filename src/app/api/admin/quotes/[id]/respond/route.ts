import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Auth Check
    const { data: userData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session?.user?.id)
      .single();

    if (!userData || !['admin', 'superadmin', 'manager', 'sales'].includes(userData.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { action, counterPrice, clauses } = body;
    const { id } = await params;

    let newStatus = 'bidded';
    if (action === 'approve') newStatus = 'accepted';
    if (action === 'counter') newStatus = 'countered';
    if (action === 'reject') newStatus = 'rejected';

    const { error } = await supabase.from('quotes').update({
      counter_price: counterPrice,
      negotiation_clauses: clauses,
      status: newStatus
    }).eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    logger.error('Failed to update quote bid', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
