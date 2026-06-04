/**
 * Service Management System
 * Handles service engineer assignments, ticket management, and service billing
 */

import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import type { 
  ServiceTicket, 
  ServiceEngineer, 
  ServiceTicketStatus, 
  ServiceTicketPriority,
  ServiceEngineerSkillLevel
} from '@/lib/types';

import { logger } from './logger';

export interface ServiceTicketRequest {
  service_id?: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  issue_description: string;
  priority?: ServiceTicketPriority;
}

export interface EngineerAssignment {
  ticket_id: string;
  engineer_id: string;
  scheduled_date?: string;
  estimated_duration?: number;
  notes?: string;
}

export interface ServiceCompletion {
  ticket_id: string;
  engineer_notes?: string;
  service_charge?: number;
  parts_used?: Array<{
    part_name: string;
    quantity: number;
    unit_cost: number;
    warranty_days?: number;
  }>;
  photos?: string[];
  actual_duration?: number;
}

export class ServiceManagementService {
  private supabase: ReturnType<typeof createServiceClient> | null;

  constructor() {
    this.supabase = isSupabaseServiceConfigured ? createServiceClient() : null;
  }

  /**
   * Create a new service ticket
   */
  async createServiceTicket(request: ServiceTicketRequest): Promise<{
    success: boolean;
    ticket_id?: string;
    ticket?: ServiceTicket;
    error?: string;
  }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase service client not configured' };
      }
      const { data: ticket, error } = await this.supabase
        .from('service_tickets')
        .insert([{
          service_id: request.service_id,
          customer_id: request.customer_id,
          customer_name: request.customer_name,
          customer_email: request.customer_email,
          customer_phone: request.customer_phone,
          customer_address: request.customer_address,
          issue_description: request.issue_description,
          priority: request.priority || 'medium',
          status: 'created'
        }])
        .select()
        .single();

      if (error) {
        logger.error('Error creating service ticket', { error, request });
        return {
          success: false,
          error: 'Failed to create service ticket'
        };
      }

      return {
        success: true,
        ticket_id: ticket.id,
        ticket
      };

    } catch (error) {
      logger.error('Error in createServiceTicket', { error, request });
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Get available service engineers based on specialization and location
   */
  async getAvailableEngineers(
    specialization?: string,
    location?: { lat: number; lng: number },
    radius?: number
  ): Promise<ServiceEngineer[]> {
    try {
      if (!this.supabase) return [];
      let query = this.supabase
        .from('service_engineers')
        .select(`
          *,
          profiles:user_id (
            name,
            email,
            mobile
          )
        `)
        .eq('is_available', true);

      // Filter by specialization if provided
      if (specialization) {
        query = query.contains('specializations', [specialization]);
      }

      const { data: engineers, error } = await query;

      if (error) {
        logger.error('Error fetching service engineers', { error, specialization, location, radius });
        return [];
      }

      // If location-based filtering is needed, implement distance calculation here
      // For now, return all available engineers
      return engineers || [];

    } catch (error) {
      logger.error('Error in getAvailableEngineers', { error, specialization, location, radius });
      return [];
    }
  }

  /**
   * Assign engineer to a service ticket
   */
  async assignEngineer(assignment: EngineerAssignment): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase service client not configured' };
      }
      const { error } = await this.supabase
        .from('service_tickets')
        .update({
          assigned_engineer_id: assignment.engineer_id,
          assigned_at: new Date().toISOString(),
          scheduled_date: assignment.scheduled_date,
          estimated_duration: assignment.estimated_duration,
          status: 'assigned',
          engineer_notes: assignment.notes
        })
        .eq('id', assignment.ticket_id);

      if (error) {
        logger.error('Error assigning engineer', { error, assignment });
        return {
          success: false,
          error: 'Failed to assign engineer'
        };
      }

      return { success: true };

    } catch (error) {
      logger.error('Error in assignEngineer', { error, assignment });
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string, 
    status: ServiceTicketStatus,
    notes?: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase service client not configured' };
      }
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'under_process') {
        updateData.started_at = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      if (notes) {
        updateData.engineer_notes = notes;
      }

      const { error } = await this.supabase
        .from('service_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) {
        logger.error('Error updating ticket status', { error, ticketId, status, notes });
        return {
          success: false,
          error: 'Failed to update ticket status'
        };
      }

      return { success: true };

    } catch (error) {
      logger.error('Error in updateTicketStatus', { error, ticketId, status, notes });
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Complete service ticket with billing information
   */
  async completeService(completion: ServiceCompletion): Promise<{
    success: boolean;
    total_cost?: number;
    error?: string;
  }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase service client not configured' };
      }

      // Call database function atomically
      const { data, error } = await this.supabase
        .rpc('complete_service_ticket_v1', {
          p_ticket_id: completion.ticket_id,
          p_engineer_notes: completion.engineer_notes || '',
          p_service_charge: completion.service_charge || 0,
          p_actual_duration: completion.actual_duration || null,
          p_photos: completion.photos || [],
          p_parts_used: completion.parts_used || []
        });

      if (error) {
        logger.error('Error completing service atomically', { error, completion });
        return {
          success: false,
          error: error.message || 'Failed to complete service'
        };
      }

      const totalCost = Number(data);

      // Update engineer statistics
      await this.updateEngineerStats(completion.ticket_id);

      return {
        success: true,
        total_cost: totalCost
      };

    } catch (error) {
      logger.error('Error in completeService', { error, completion });
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Get service tickets for an engineer
   */
  async getEngineerTickets(
    engineerId: string,
    status?: ServiceTicketStatus
  ): Promise<ServiceTicket[]> {
    try {
      if (!this.supabase) return [];
      let query = this.supabase
        .from('service_tickets')
        .select(`
          *,
          service_parts (*)
        `)
        .eq('assigned_engineer_id', engineerId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: tickets, error } = await query;

      if (error) {
        logger.error('Error fetching engineer tickets', { error, engineerId, status });
        return [];
      }

      return tickets || [];

    } catch (error) {
      logger.error('Error in getEngineerTickets', { error, engineerId, status });
      return [];
    }
  }

  /**
   * Get customer service history
   */
  async getCustomerServiceHistory(
    customerId: string
  ): Promise<ServiceTicket[]> {
    try {
      if (!this.supabase) return [];
      const { data: tickets, error } = await this.supabase
        .from('service_tickets')
        .select(`
          *,
          service_parts (*),
          assigned_engineer:assigned_engineer_id (
            id,
            employee_id,
            skill_level,
            profiles:user_id (
              name,
              email
            )
          )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching customer service history', { error, customerId });
        return [];
      }

      return tickets || [];

    } catch (error) {
      logger.error('Error in getCustomerServiceHistory', { error, customerId });
      return [];
    }
  }

  /**
   * Create or update service engineer profile
   */
  async createOrUpdateEngineer(
    userId: string,
    engineerData: {
      employee_id?: string;
      specializations: string[];
      skill_level: ServiceEngineerSkillLevel;
      available_hours?: Record<string, any>;
      service_radius?: number;
    }
  ): Promise<{
    success: boolean;
    engineer_id?: string;
    error?: string;
  }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase service client not configured' };
      }
      const { data: engineer, error } = await this.supabase
        .from('service_engineers')
        .upsert({
          user_id: userId,
          employee_id: engineerData.employee_id,
          specializations: engineerData.specializations,
          skill_level: engineerData.skill_level,
          available_hours: engineerData.available_hours,
          service_radius: engineerData.service_radius || 50,
          is_available: true
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating or updating engineer', { error, userId, engineerData });
        return {
          success: false,
          error: 'Failed to create/update engineer profile'
        };
      }

      return {
        success: true,
        engineer_id: engineer.id
      };

    } catch (error) {
      logger.error('Error in createOrUpdateEngineer', { error, userId, engineerData });
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Update engineer performance statistics
   */
  private async updateEngineerStats(ticketId: string): Promise<void> {
    try {
      if (!this.supabase) return;
      // Get ticket details
      const { data: ticket } = await this.supabase
        .from('service_tickets')
        .select('assigned_engineer_id')
        .eq('id', ticketId)
        .single();

      if (!ticket?.assigned_engineer_id) return;

      // Update engineer total services and recalculate rating
      const { data: completedTickets } = await this.supabase
        .from('service_tickets')
        .select('customer_rating')
        .eq('assigned_engineer_id', ticket.assigned_engineer_id)
        .eq('status', 'completed')
        .not('customer_rating', 'is', null);

      if (completedTickets) {
        const totalServices = completedTickets.length;
        const avgRating = completedTickets.reduce((sum, t) => sum + (t.customer_rating || 0), 0) / totalServices;

        await this.supabase
          .from('service_engineers')
          .update({
            total_services: totalServices,
            rating: Math.round(avgRating * 100) / 100
          })
          .eq('id', ticket.assigned_engineer_id);
      }

    } catch (error) {
      logger.error('Error updating engineer stats', { error, ticketId });
    }
  }

  /**
   * Submit customer feedback and rating
   */
  async submitCustomerFeedback(
    ticketId: string,
    rating: number,
    feedback?: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase service client not configured' };
      }
      const { error } = await this.supabase
        .from('service_tickets')
        .update({
          customer_rating: rating,
          customer_feedback: feedback
        })
        .eq('id', ticketId);

      if (error) {
        logger.error('Error submitting customer feedback', { error, ticketId, rating });
        return {
          success: false,
          error: 'Failed to submit feedback'
        };
      }

      // Update engineer rating
      await this.updateEngineerStats(ticketId);

      return { success: true };

    } catch (error) {
      logger.error('Error in submitCustomerFeedback', { error, ticketId, rating });
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }
}

// Export singleton instance
export const serviceManagementService = new ServiceManagementService();