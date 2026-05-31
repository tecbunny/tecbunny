import { NextRequest, NextResponse } from 'next/server';

import { serviceManagementService } from '@/lib/service-management';
import { logger } from '@/lib/logger';

/**
 * Create a new service ticket
 * POST /api/services/tickets
 */
export async function POST(request: NextRequest) {
  try {
    const ticketData = await request.json();
    const normalizedTicketData = {
      ...ticketData,
      service_id: ticketData.service_id ?? ticketData.service_type ?? null,
      issue_description: ticketData.issue_description ?? ticketData.description,
    };

    // Validate required fields
    if (!normalizedTicketData.customer_id || !normalizedTicketData.customer_name || !normalizedTicketData.customer_email || !normalizedTicketData.issue_description) {
      return NextResponse.json(
        { error: 'Customer ID, name, email, and issue description are required' },
        { status: 400 }
      );
    }

    // Create service ticket
    const result = await serviceManagementService.createServiceTicket(normalizedTicketData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ticket: result.ticket
    });

  } catch (error) {
    logger.error('Error in create service ticket API:', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get service tickets
 * GET /api/services/tickets?customerId=123&engineerId=456
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const engineerId = searchParams.get('engineerId');

    let tickets;

    if (customerId) {
      // Get customer service history
      tickets = await serviceManagementService.getCustomerServiceHistory(customerId);
    } else if (engineerId) {
      // Get engineer tickets
      tickets = await serviceManagementService.getEngineerTickets(engineerId);
    } else {
      return NextResponse.json(
        { error: 'Either customerId or engineerId is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tickets
    });

  } catch (error) {
    logger.error('Error in get service tickets API:', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
