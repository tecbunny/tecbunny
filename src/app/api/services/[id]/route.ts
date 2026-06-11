import { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';

// export const dynamic = 'force-dynamic';

/**
 * GET /api/services/[id]
 * Get a specific service
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('UNAUTHORIZED', { correlationId });
    }

    const { id } = await params;

    const { data: service, error } = await supabase
      .from('services')
      .select(`
        *,
        service_requests(
          id,
          customer_id,
          request_status,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Failed to fetch service', { error, serviceId: id, correlationId });
      return apiError('DATABASE_ERROR', { correlationId });
    }

    if (!service) {
      return apiError('NOT_FOUND', { correlationId });
    }

    return apiSuccess({ service }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error fetching service', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

/**
 * PUT /api/services/[id]
 * Update a service
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('UNAUTHORIZED', { correlationId });
    }

    const { id } = await params;
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
      status,
      is_featured
    } = body;

    // Update service
    const { data: service, error } = await supabase
      .from('services')
      .update({
        name,
        description,
        category,
        price: price ? parseFloat(price) : undefined,
        duration_hours: duration_hours ? parseInt(duration_hours) : null,
        features: Array.isArray(features) ? features : undefined,
        requirements: Array.isArray(requirements) ? requirements : undefined,
        icon,
        status,
        is_featured,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update service', { error, serviceId: id, correlationId });
      return apiError('DATABASE_ERROR', { correlationId });
    }

    logger.info('Service updated successfully', { 
      serviceId: id, 
      correlationId 
    });

    return apiSuccess({
      service,
      message: 'Service updated successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error updating service', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}

/**
 * DELETE /api/services/[id]
 * Delete a service
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || null;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('UNAUTHORIZED', { correlationId });
    }

    const { id } = await params;

    // Check if service has active requests
    const { data: activeRequests } = await supabase
      .from('service_requests')
      .select('id')
      .eq('service_id', id)
      .in('request_status', ['pending', 'in_progress', 'assigned']);

    if (activeRequests && activeRequests.length > 0) {
      return apiError('CONFLICT', { 
        overrideMessage: 'Cannot delete service with active requests',
        details: { activeRequests: activeRequests.length },
        correlationId 
      });
    }

    // Delete service
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete service', { error, serviceId: id, correlationId });
      return apiError('DATABASE_ERROR', { correlationId });
    }

    logger.info('Service deleted successfully', { 
      serviceId: id, 
      correlationId 
    });

    return apiSuccess({
      message: 'Service deleted successfully'
    }, correlationId);

  } catch (error: any) {
    const correlationId = request.headers.get('x-correlation-id') || null;
    logger.error('Error deleting service', { error: error.message, correlationId });
    return apiError('INTERNAL_ERROR', { correlationId });
  }
}


