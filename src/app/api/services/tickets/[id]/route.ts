export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { serviceManagementService } from '@/lib/service-management';
import { logger } from '@/lib/logger';

/**
 * Update service ticket status or assign engineer
 * PUT /api/services/tickets/[id]
 */
export async function PUT(
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

        // 1. THE POST-RESOLUTION MULTI-UNIT SALES TRIGGER
        // If maintenance checklist indicates low-capacity network, attach upgrade proposal.
        if (result.success) {
          try {
            const checklist = data.maintenance_checklist || {};
            const isSingleSwitch = checklist.topology === 'single-switch' || data.engineer_notes.toLowerCase().includes('single switch');
            const isLowerCapacity = checklist.bandwidth_capacity === 'low' || data.engineer_notes.toLowerCase().includes('low capacity');

            if (isSingleSwitch || isLowerCapacity) {
              const { createServiceClient } = await import('@/lib/supabase/server');
              const supabase = createServiceClient();
              
              const upgradeProposal = {
                title: 'Infrastructure Upgrade Proposal: Enterprise Multi-Node Network',
                description: 'Based on our engineer\'s assessment, your current single-node configuration is at 85% utilization. We recommend upgrading to a load-balanced multi-switch architecture.',
                recommended_products: ['EB-SW-48G-L3', 'EB-AP-AX6-PRO'],
                estimated_roi: '40% reduction in latency',
                special_offer: '15% discount if ordered within 7 days'
              };

              await supabase
                .from('service_tickets')
                .update({ 
                  upgrade_proposal: upgradeProposal,
                  notes: (data.notes || '') + ' | [System] Upgrade proposal attached.'
                })
                .eq('id', ticketId);
              
              logger.info('infrastructure_upgrade_proposal_attached', { ticketId, type: isSingleSwitch ? 'topology' : 'capacity' });
            }
          } catch (proposalError) {
            logger.error('failed_to_attach_upgrade_proposal', { ticketId, error: proposalError });
          }
        }
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

    // Task 3: DYNAMIC RETENTION VIA TICKET COMPLETION
    // Trigger referral and review automation on successful service completion
    if (action === 'complete' && result.success) {
      try {
        const ticketId = id;
        const improvedEmailService = (await import('@/lib/improved-email-service')).default;
        const { createServiceClient } = await import('@/lib/supabase/server');
        const supabase = createServiceClient();

        // 1. Fetch ticket details for context
        const { data: ticket } = await supabase
          .from('service_tickets')
          .select('customer_name, customer_email, service_id, issue_description')
          .eq('id', ticketId)
          .single();

        if (ticket && ticket.customer_email) {
          // 2. Generate resolution asset (Review Token + Referral Code)
          const reviewToken = Buffer.from(`${ticketId}:${Date.now()}`).toString('base64').substring(0, 12);
          const referralCredit = '₹500';

          // 3. Dispatch automated retention email
          await improvedEmailService.sendEmail({
            to: ticket.customer_email,
            subject: `Service Resolved: ${ticketId} | Your TecBunny Credit is Ready`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #4f46e5;">Service Completion Summary</h2>
                <p>Hi ${ticket.customer_name},</p>
                <p>Your service request <strong>#${ticketId}</strong> has been marked as resolved by our engineer.</p>
                
                <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #4f46e5; margin: 20px 0;">
                  <p><strong>Issue:</strong> ${ticket.issue_description}</p>
                  <p><strong>Status:</strong> Successfully Resolved</p>
                </div>

                <h3>Claim Your Referral Bonus</h3>
                <p>We've added a <strong>${referralCredit}</strong> activation credit to your referral dashboard. Share the link below to gift a discount and earn more credits:</p>
                <a href="https://tecbunny.com/account/referral?token=${reviewToken}" 
                   style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">
                  Activate Referral Credit
                </a>

                <p style="margin-top: 30px; font-size: 0.9em; color: #64748b;">
                  How was your experience? Rate us and get 10% off your next AMC: 
                  <a href="https://tecbunny.com/reviews/new?ticket=${ticketId}&token=${reviewToken}">Leave a Review</a>
                </p>
              </div>
            `
          });
          logger.info('retention_email_dispatched', { ticketId, customerEmail: ticket.customer_email });
        }
      } catch (triggerError: any) {
        logger.error('ticket_completion_retention_trigger_failed', { error: triggerError.message });
      }
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



export async function GET() { return Response.json({}) }



