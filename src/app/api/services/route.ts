import { NextRequest } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { getSessionWithRole } from '@/lib/auth/server-role';

const ADMIN_ROLES = new Set(['admin', 'manager']);

// export const dynamic = 'force-dynamic';

/**
 * GET /api/services
 * Get all services
 */
export async function GET(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const { supabase: authClient, session, role } = await getSessionWithRole(request);
    if (!session) {
      return apiError('UNAUTHORIZED', { correlationId });
    }
    if (!role || !ADMIN_ROLES.has(role)) {
      return apiError('FORBIDDEN', { correlationId });
    }

    const supabase = role && ADMIN_ROLES.has(role) && isSupabaseServiceConfigured
      ? createServiceClient()
      : authClient ?? await createClient();

    // Get services with related data
    const { data: services, error } = await supabase
      .from('services')
      .select(`
        *,
        service_requests(
          id,
          request_status,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch services', { error, correlationId });
      return apiError('DATABASE_ERROR', { correlationId });
    }

    // Calculate stats for each service
    const servicesWithStats = services?.map(service => ({
      ...service,
      total_requests: service.service_requests?.length || 0,
      pending_requests: service.service_requests?.filter((req: any) => req.request_status === 'pending').length || 0,
      active_requests: service.service_requests?.filter((req: any) => ['in_progress', 'assigned'].includes(req.request_status)).length || 0
    })) || [];

    return apiSuccess({
      services: servicesWithStats,
      total: servicesWithStats.length
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error fetching services', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

/**
 * POST /api/services
 * Create a new service
 */
export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const { supabase: authClient, session, role } = await getSessionWithRole(request);
    if (!session) {
      return apiError('UNAUTHORIZED', { correlationId });
    }
    if (!role || !ADMIN_ROLES.has(role)) {
      return apiError('FORBIDDEN', { correlationId });
    }

    const supabase = role && ADMIN_ROLES.has(role) && isSupabaseServiceConfigured
      ? createServiceClient()
      : authClient ?? await createClient();

    const body = await request.json();
    const {
      name,
      description,
      category,
      price,
      duration_hours,
      features,
      requirements,
      icon,
      status = 'active',
      is_featured = false
    } = body;

    // Validate required fields
    if (!name || !description || !category || !price) {
      return apiError('VALIDATION_ERROR', { correlationId });
    }

    // Create service
    const { data: service, error } = await supabase
      .from('services')
      .insert({
        name,
        description,
        category,
        price: parseFloat(price),
        duration_hours: duration_hours ? parseInt(duration_hours) : null,
        features: Array.isArray(features) ? features : [],
        requirements: Array.isArray(requirements) ? requirements : [],
        icon,
        status,
        is_featured,
  created_by: session.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create service', { error, correlationId });
      return apiError('DATABASE_ERROR', { correlationId });
    }

    logger.info('Service created successfully', { 
      serviceId: service.id, 
      name: service.name,
      correlationId 
    });

    return apiSuccess({
      service,
      message: 'Service created successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error creating service', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}
