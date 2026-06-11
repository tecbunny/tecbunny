/**
 * OTP Verification Service for Agent Orders and Customer Verification
 * Handles OTP generation, validation, and management
 */

import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import type { OtpType } from '@/lib/types';
import { emailClient } from './email/client';
import { sendInfobipWhatsAppOtp } from './infobip/infobip-whatsapp-otp';
import crypto from 'crypto';
import { rateLimit } from './rate-limit';

import { logger } from './logger';

export interface OtpRequest {
  order_id: string;
  agent_id?: string;
  customer_phone: string;
  customer_email?: string;
  otp_type: OtpType;
  created_by?: string;
  channel?: 'whatsapp' | 'email' | 'both';
}

export interface OtpVerification {
  order_id: string;
  customer_phone: string;
  otp_code: string;
}

export class OtpService {
  private supabase: ReturnType<typeof createServiceClient> | null;
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;

  constructor() {
    this.supabase = isSupabaseServiceConfigured ? createServiceClient() : null;
  }

  /**
   * Generate a 6-digit OTP code using cryptographically strong pseudo-random numbers
   */
  private generateOtpCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Generate and send OTP for agent order verification
   */
  async generateOtp(request: OtpRequest, skipPhoneDelivery: boolean = false): Promise<{
    success: boolean;
    otp_id?: string;
    expires_at?: string;
    error?: string;
    otp_code?: string;
  }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase service client is not configured' };
      }

      // SECURITY: Rate limit OTP generation per phone number (60s cooldown)
      const rateKey = `otp_gen:${request.customer_phone}`;
      const isAllowed = await rateLimit(rateKey, 1, 60000);
      if (!isAllowed) {
        return { success: false, error: 'Please wait 60 seconds before requesting another OTP.' };
      }

      // Check if there's already a pending OTP for this order
      const { data: existingOtp } = await this.supabase
        .from('order_otp_verifications')
        .select('*')
        .eq('order_id', request.order_id)
        .eq('customer_phone', request.customer_phone)
        .eq('verified', false)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (existingOtp) {
        if (!skipPhoneDelivery) {
          // Resend existing OTP
          await this.sendOtpWhatsApp(request.customer_phone, existingOtp.otp_code, request.otp_type);
        }
        
        return {
          success: true,
          otp_id: existingOtp.id,
          expires_at: existingOtp.expires_at,
          otp_code: existingOtp.otp_code
        };
      }

      // Generate new OTP
      const otpCode = this.generateOtpCode();
      const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

      const { data: otpRecord, error } = await this.supabase
        .from('order_otp_verifications')
        .insert([{
          order_id: request.order_id,
          agent_id: request.agent_id,
          customer_phone: request.customer_phone,
          otp_code: otpCode,
          otp_type: request.otp_type,
          expires_at: expiresAt.toISOString(),
          created_by: request.created_by
        }])
        .select()
        .single();

      if (error) {
        logger.error('Error creating OTP record', { error, request });
        return {
          success: false,
          error: 'Failed to generate OTP'
        };
      }

      // Send OTP via Email if requested or if channel is 'both'
      if ((request.channel === 'email' || request.channel === 'both') && request.customer_email) {
        try {
          await emailClient.sendOtpEmail(request.customer_email, otpCode);
        } catch (emailError) {
          logger.error('Failed to send OTP email', { error: emailError, email: request.customer_email });
          if (request.channel === 'email') {
            return { success: false, error: 'Failed to send OTP email' };
          }
        }
      }

      if (!skipPhoneDelivery && (request.channel === 'whatsapp' || request.channel === 'both' || !request.channel)) {
        const whatsAppResult = await this.sendOtpWhatsApp(request.customer_phone, otpCode, request.otp_type);
        
        if (!whatsAppResult.success && request.channel !== 'both') {
          await this.supabase
            .from('order_otp_verifications')
            .delete()
            .eq('id', otpRecord.id);

          return {
            success: false,
            error: 'Failed to send OTP via WhatsApp'
          };
        }
      }

      return {
        success: true,
        otp_id: otpRecord.id,
        expires_at: expiresAt.toISOString(),
        otp_code: otpCode
      };

    } catch (error) {
      logger.error('Error in generateOtp', { error, request });
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(verification: OtpVerification): Promise<{
    success: boolean;
    verified?: boolean;
    error?: string;
    attempts_left?: number;
  }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase service client is not configured' };
      }

      // SECURITY: Use atomic RPC to prevent brute-force race conditions (TOCTOU)
      const { data, error: rpcError } = await this.supabase.rpc('verify_order_otp_atomic', {
        p_order_id: verification.order_id,
        p_customer_phone: verification.customer_phone,
        p_otp_code: verification.otp_code,
        p_max_attempts: this.MAX_ATTEMPTS
      });

      if (rpcError) {
        logger.error('Error verifying OTP via RPC', { error: rpcError, verification });
        return { success: false, error: 'Internal server error during verification' };
      }

      const result = data as { success: boolean; verified?: boolean; error?: string; attempts_left?: number };
      
      if (result.success && result.verified) {
        return { success: true, verified: true };
      }

      return {
        success: false,
        error: result.error || 'Invalid OTP',
        attempts_left: result.attempts_left
      };

    } catch (error) {
      logger.error('Error in verifyOtp service', { error, verification });
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Send OTP via Infobip WhatsApp
   */
  private async sendOtpWhatsApp(
    phone: string, 
    otpCode: string, 
    otpType: OtpType
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`;
      const userName = otpType === 'agent_order' ? 'Agent order customer' : 'Customer';
      const result = await sendInfobipWhatsAppOtp(formattedPhone, otpCode, userName, otpCode);

      if (!result.success) {
        return { success: false, error: result.error || 'WhatsApp delivery failed' };
      }

      logger.debug('WhatsApp OTP sent', { phone: formattedPhone, messageId: result.messageId });
      return { success: true };

    } catch (error) {
      logger.error('Error sending WhatsApp OTP', { error, phone });
      return {
        success: false,
        error: 'Failed to send OTP via WhatsApp'
      };
    }
  }

  /**
   * Update order with OTP verification status
   */
  private async updateOrderOtpStatus(orderId: string, verified: boolean) {
    try {
      if (!this.supabase) return;
      await this.supabase
        .from('orders')
        .update({
          otp_verified: verified,
          otp_verified_at: verified ? new Date().toISOString() : null
        })
        .eq('id', orderId);
    } catch (error) {
      logger.error('Error updating order OTP status', { error, orderId, verified });
    }
  }

  /**
   * Get OTP verification status for an order
   */
  async getOtpStatus(orderId: string): Promise<{
    verified: boolean;
    pending: boolean;
    expired: boolean;
    attempts_used: number;
    max_attempts: number;
  }> {
    try {
      if (!this.supabase) {
        return {
          verified: false,
          pending: false,
          expired: false,
          attempts_used: 0,
          max_attempts: this.MAX_ATTEMPTS
        };
      }
      const { data: otpRecord } = await this.supabase
        .from('order_otp_verifications')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!otpRecord) {
        return {
          verified: false,
          pending: false,
          expired: false,
          attempts_used: 0,
          max_attempts: this.MAX_ATTEMPTS
        };
      }

      const isExpired = new Date(otpRecord.expires_at) < new Date();
      const isPending = !otpRecord.verified && !isExpired && otpRecord.attempts < this.MAX_ATTEMPTS;

      return {
        verified: otpRecord.verified,
        pending: isPending,
        expired: isExpired,
        attempts_used: otpRecord.attempts,
        max_attempts: this.MAX_ATTEMPTS
      };

    } catch (error) {
      logger.error('Error getting OTP status', { error, orderId });
      return {
        verified: false,
        pending: false,
        expired: false,
        attempts_used: 0,
        max_attempts: this.MAX_ATTEMPTS
      };
    }
  }

  /**
   * Clean up expired OTP records (should be run periodically)
   */
  async cleanupExpiredOtps(): Promise<number> {
    try {
      if (!this.supabase) return 0;
      const { count, error } = await this.supabase
        .from('order_otp_verifications')
        .delete({ count: 'exact' })
        .lt('expires_at', new Date().toISOString())
        .eq('verified', false);

      if (error) {
        logger.error('Error cleaning up expired OTPs', { error });
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error('Error in cleanupExpiredOtps', { error });
      return 0;
    }
  }
}
export const otpService = new OtpService();
