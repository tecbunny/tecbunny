import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Public API for Whitelabel Embeddable Configurator
 * GET /api/v1/embed/configurator
 * 
 * Validates agent referral token and returns isolated configurator layout data.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-tecbunny-agent-token');
  const referralId = request.nextUrl.searchParams.get('ref');

  if (!authHeader && !referralId) {
    return NextResponse.json({ error: 'Missing agent attribution context' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    
    // Validate Agent
    const { data: agent, error: agentError } = await supabase
      .from('sales_agents')
      .select('id, status, referral_code')
      .eq('referral_code', referralId || authHeader)
      .single();

    if (agentError || !agent || agent.status !== 'approved') {
      return NextResponse.json({ error: 'Invalid or inactive agent token' }, { status: 403 });
    }

    // Return clean configuration fields (Isolated for Frame rendering)
    const configurationMetadata = {
      version: '1.0.0',
      agentId: agent.id,
      referralCode: agent.referral_code,
      ui: {
        theme: 'dark',
        brandColor: '#2563EB', // Tech Blue
        accentColor: '#8b5cf6', // Purple 500
      },
      fields: [
        { id: 'systemType', label: 'Security System Type', options: ['Analog (Standard)', 'IP (Enterprise)'] },
        { id: 'premise', label: 'Premise Category', options: ['Residential', 'Commercial', 'Industrial'] },
        { id: 'cameraCount', label: 'Node/Camera Count', range: [1, 32], default: 4 },
        { id: 'resolution', label: 'Precision Level', options: ['2MP Standard', '5MP Ultra', '8MP 4K'] },
        { id: 'storage', label: 'Archival Retention', options: ['15 Days', '30 Days', '60 Days'] }
      ],
      endpoints: {
        submission: 'https://tecbunny.com/api/agents/orders/create'
      }
    };

    return NextResponse.json(configurationMetadata);

  } catch (error: any) {
    logger.error('embed_configurator_api_failed', { error: error.message });
    return NextResponse.json({ error: 'Internal configuration fetch failure' }, { status: 500 });
  }
}
