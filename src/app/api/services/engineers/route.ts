import { NextRequest, NextResponse } from 'next/server';

import { serviceManagementService } from '@/lib/service-management';
import { logger } from '@/lib/logger';

/**
 * Create or update a service engineer
 * POST /api/services/engineers
 */
export async function POST(request: NextRequest) {
  try {
    const engineerData = await request.json();

    // Validate required fields
    if (!engineerData.name || !engineerData.phone || !engineerData.specializations) {
      return NextResponse.json(
        { error: 'Name, phone, and specializations are required' },
        { status: 400 }
      );
    }

    // Create or update engineer
    const result = await serviceManagementService.createOrUpdateEngineer(
      engineerData.userId || engineerData.id,
      {
        employee_id: engineerData.employee_id,
        specializations: engineerData.specializations,
        skill_level: engineerData.skill_level || 'Intermediate',
        available_hours: engineerData.available_hours,
        service_radius: engineerData.service_radius
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      engineer_id: result.engineer_id
    });

  } catch (error) {
    logger.error('Error in create/update engineer API:', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get available engineers for a service type
 * GET /api/services/engineers?serviceType=installation&location=mumbai
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('serviceType');

    if (!serviceType) {
      return NextResponse.json(
        { error: 'Service type is required' },
        { status: 400 }
      );
    }

    // Get available engineers
    const engineers = await serviceManagementService.getAvailableEngineers(
      serviceType,
      undefined // Location parsing would need to be implemented if needed
    );

    return NextResponse.json({
      success: true,
      engineers
    });

  } catch (error) {
    logger.error('Error in get engineers API:', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
