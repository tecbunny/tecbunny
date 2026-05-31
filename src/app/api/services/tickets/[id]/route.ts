import { NextRequest, NextResponse } from 'next/server';

import { serviceManagementService } from '@/lib/service-management';
import { logger } from '@/lib/logger';

/**
 * Update service ticket status or assign engineer
 * PUT /api/services/tickets/[id]
 */
async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { action, ...data } = await request.json();
    const { id } = await params;
    const ticketId = id;

    let result;

    switch (action) {
      case 'assign_engineer':
        if (!data.engineer_id) {
          return NextResponse.json(
            { error: 'Engineer ID is required for assignment' },
            { status: 400 }
          );
        }
        result = await serviceManagementService.assignEngineer({
          ticket_id: ticketId,
          engineer_id: data.engineer_id,
          scheduled_date: data.scheduled_date,
          notes: data.notes
        });
        break;

      case 'update_status':
        if (!data.status) {
          return NextResponse.json(
            { error: 'Status is required for status update' },
            { status: 400 }
          );
        }
        result = await serviceManagementService.updateTicketStatus(
          ticketId,
          data.status,
          data.notes
        );
        break;

      case 'complete':
        if (!data.engineer_notes) {
          return NextResponse.json(
            { error: 'Engineer notes are required' },
            { status: 400 }
          );
        }
        result = await serviceManagementService.completeService({
          ticket_id: ticketId,
          engineer_notes: data.engineer_notes,
          service_charge: data.service_charge,
          parts_used: data.parts_used,
          photos: data.photos,
          actual_duration: data.actual_duration
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use assign_engineer, update_status, or complete' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Ticket ${action} completed successfully`,
      data: result
    });

  } catch (error) {
    logger.error('Error in update ticket API:', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function generateStaticParams() {
  return []
}

export async function GET() { return Response.json({}) }



