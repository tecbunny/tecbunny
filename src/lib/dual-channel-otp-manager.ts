import { randomBytes } from 'crypto';

import { createClient } from '@supabase/supabase-js';

import { SMSOTPService, SMSResponse } from './sms/sms-otp-service';
import improvedEmailService, { EmailResult } from './improved-email-service';
import { logger } from './logger';

import type { Database } from './types/database';

export type OTPChannel = 'sms' | 'email';
export type OTPPurpose = 'signup' | 'recovery' | 'login_2fa' | 'agent_order';

export interface OTPDeliveryOptions {
  channel: OTPChannel;
  email?: string;
  phone?: string;
  purpose: OTPPurpose;
  userPreferences?: {
    preferredChannel: OTPChannel;
    smsEnabled: boolean;
    emailEnabled: boolean;
  };
}

export interface OTPDeliveryResult {
  success: boolean;
  channel: OTPChannel;
  deliveryId?: string;
  error?: string;
  fallbackUsed?: boolean;
  retryAvailable?: boolean;
}

type StoredOTPRecord = {
  id: string;
  email: string | null;
  phone: string | null;
  otp: string | null;
  otp_code: string | null;
  type: string;
  channel: string | null;
  used: boolean;
  expires_at: string;
  created_at: string;
};

export interface UserCommunicationPreferences {
  id: string;
  userId: string;
  preferredOTPChannel: OTPChannel;
  smsNotifications: boolean;
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  orderUpdates: boolean;
  serviceUpdates: boolean;
  securityAlerts: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Enhanced OTP Manager with Dual-Channel Delivery
 * Supports both SMS (2Factor.in) and Email (Nodemailer) delivery
 * Implements user preferences and intelligent fallback
 */
export class DualChannelOTPManager {
  private smsService: SMSOTPService | null = null;
  private emailService: typeof improvedEmailService;
  private supabase: ReturnType<typeof createClient<Database>> | null;

  constructor() {
    // Don't initialize SMS service immediately to avoid build errors
    this.emailService = improvedEmailService;
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      this.supabase = createClient<Database>(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } else {
      this.supabase = null;
      logger.warn('Supabase env vars missing for dual-channel OTP');
    }
  }

  private getSMSService(): SMSOTPService {
    if (!this.smsService) {
      this.smsService = new SMSOTPService();
    }
    return this.smsService;
  }

  /**
   * Generate secure 4-digit OTP
   */
  private generateOTP(): string {
    try {
      // Use crypto for secure random number generation
      if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
        // Browser environment
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        const value = array[0];
        return (1000 + (value % 9000)).toString();
      }
      
      // Node.js environment
      const buffer = randomBytes(4);
      const value = buffer.readUInt32BE(0);
      return (1000 + (value % 9000)).toString();
    } catch (error) {
      // Fallback to Math.random (less secure but works)
      logger.warn('Crypto failed, using Math.random fallback', {
        error: error instanceof Error ? error.message : String(error)
      });
      return Math.floor(1000 + Math.random() * 9000).toString();
    }
  }

  /**
   * Store OTP in database with channel information
   */
  private async storeOTP(
    identifier: string, 
    otp: string, 
    purpose: OTPPurpose, 
    channel: OTPChannel,
    expiresIn: number = 10 * 60 * 1000 // 10 minutes
  ): Promise<boolean> {
    if (!this.supabase) {
      logger.warn('Cannot store OTP: Supabase not configured');
      return false;
    }

    try {
      const expiresAt = new Date(Date.now() + expiresIn).toISOString();
      
      const { error } = await this.supabase!
        .from('otp_codes')
        .insert({
          email: channel === 'email' ? identifier : null,
          phone: channel === 'sms' ? identifier : null,
          otp,
          type: purpose,
          channel,
          expires_at: expiresAt,
          used: false
        } as any);

      if (error) {
        logger.error('Failed to store OTP:', { error: error.message, code: error.code });
        return false;
      }

      logger.info('OTP stored successfully:', { 
        identifier, 
        purpose, 
        channel,
        expiresAt 
      });
      return true;

    } catch (error) {
      logger.error('Error storing OTP:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * Get user communication preferences
   */
  async getUserPreferences(userId: string): Promise<UserCommunicationPreferences | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('user_communication_preferences')
        .select('*')
        .eq('userId', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        logger.error('Error fetching user preferences:', { error: error.message, code: error.code });
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error getting user preferences:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Send OTP via SMS using 2Factor.in API
   */
  private async sendSMSOTP(
    phone: string, 
    otp: string, 
    purpose: OTPPurpose
  ): Promise<OTPDeliveryResult> {
    try {
      const purposeMap = {
        signup: 'account verification',
        recovery: 'password reset',
        login_2fa: '2-factor authentication',
        agent_order: 'order verification'
      };

      const result: SMSResponse = await this.getSMSService().sendOTP(
        phone, 
        otp, 
        purposeMap[purpose]
      );

      return {
        success: result.success,
        channel: 'sms',
        deliveryId: result.messageId,
        error: result.error
      };

    } catch (error) {
      logger.error('SMS OTP delivery failed:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        success: false,
        channel: 'sms',
        error: error instanceof Error ? error.message : 'SMS delivery failed'
      };
    }
  }

  /**
   * Send OTP via Email using Nodemailer
   */
  private async sendEmailOTP(
    email: string, 
    otp: string, 
    purpose: OTPPurpose
  ): Promise<OTPDeliveryResult> {
    try {
      const subjectMap = {
        signup: 'Verify Your TecBunny Account',
        recovery: 'Reset Your TecBunny Password',
        login_2fa: 'TecBunny Login Verification',
        agent_order: 'Order Verification Required'
      };

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">TecBunny Solutions</h1>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Your Verification Code</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              Your OTP for ${purpose.replace('_', ' ')} is:
            </p>
            <div style="background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px;">
              This code will expire in 10 minutes. If you didn't request this, please ignore this email.
            </p>
          </div>
          <div style="background: #333; color: #fff; padding: 15px; text-align: center; font-size: 12px;">
            © 2025 TecBunny Solutions. All rights reserved.
          </div>
        </div>
      `;

      const result: EmailResult = await this.emailService.sendEmail({
        to: email,
        subject: subjectMap[purpose],
        html: htmlContent,
        text: `Your TecBunny verification code is: ${otp}. This code expires in 10 minutes.`
      });

      return {
        success: result.success,
        channel: 'email',
        deliveryId: result.messageId,
        error: result.error
      };

    } catch (error) {
      logger.error('Email OTP delivery failed:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        success: false,
        channel: 'email',
        error: error instanceof Error ? error.message : 'Email delivery failed'
      };
    }
  }

  /**
   * Send OTP with intelligent channel selection and fallback
   */
  async sendOTP(options: OTPDeliveryOptions): Promise<OTPDeliveryResult> {
    const otp = this.generateOTP();
    const { channel, email, phone, purpose, userPreferences } = options;

    // Validate inputs based on channel
    if (channel === 'email' && !email) {
      return {
        success: false,
        channel,
        error: 'Email address required for email OTP'
      };
    }

    if (channel === 'sms' && !phone) {
      return {
        success: false,
        channel,
        error: 'Phone number required for SMS OTP'
      };
    }

    // Store OTP in database
    const identifier = channel === 'email' ? email! : phone!;
    const stored = await this.storeOTP(identifier, otp, purpose, channel);
    
    if (!stored) {
      logger.warn('OTP not stored in database, proceeding with delivery');
    }

    // Attempt primary delivery
    let result: OTPDeliveryResult;
    
    if (channel === 'sms') {
      result = await this.sendSMSOTP(phone!, otp, purpose);
    } else {
      result = await this.sendEmailOTP(email!, otp, purpose);
    }

    // If primary delivery fails, attempt fallback if both channels available
    if (!result.success && email && phone && userPreferences?.smsEnabled && userPreferences?.emailEnabled) {
      logger.info('Primary OTP delivery failed, attempting fallback', { 
        primaryChannel: channel,
        fallbackChannel: channel === 'sms' ? 'email' : 'sms'
      });

      const fallbackChannel: OTPChannel = channel === 'sms' ? 'email' : 'sms';
      let fallbackResult: OTPDeliveryResult;

      // Store OTP for fallback channel
      const fallbackIdentifier = fallbackChannel === 'email' ? email : phone;
      await this.storeOTP(fallbackIdentifier, otp, purpose, fallbackChannel);

      if (fallbackChannel === 'sms') {
        fallbackResult = await this.sendSMSOTP(phone, otp, purpose);
      } else {
        fallbackResult = await this.sendEmailOTP(email, otp, purpose);
      }

      if (fallbackResult.success) {
        return {
          ...fallbackResult,
          fallbackUsed: true
        };
      }
    }

    return result;
  }

  /**
   * Verify OTP from either channel
   */
  async verifyOTP(
    identifier: string, 
    otp: string, 
    purpose: OTPPurpose,
    channel?: OTPChannel
  ): Promise<{ valid: boolean; used?: boolean; expired?: boolean }> {
    if (!this.supabase) {
      logger.warn('Cannot verify OTP: Supabase not configured');
      return { valid: false };
    }

    try {
      // Build query based on available information
      const nowIso = new Date().toISOString();
      let query = this.supabase
        .from('otp_codes')
        .select('*')
        .eq('type', purpose)
        .eq('used', false)
        .gt('expires_at', nowIso);

      const normalizedIdentifier = identifier.trim();

      if (channel === 'email' || (!channel && normalizedIdentifier.includes('@'))) {
        query = query.eq('email', normalizedIdentifier.toLowerCase());
      } else if (channel === 'sms' || (!channel && /^\+?[\d\s-()]+$/.test(normalizedIdentifier))) {
        const candidates = new Set<string>();
        if (normalizedIdentifier) candidates.add(normalizedIdentifier);
        const digitsOnly = normalizedIdentifier.replace(/[^\d]/g, '');
        if (digitsOnly) candidates.add(digitsOnly);
        const lowered = normalizedIdentifier.toLowerCase();
        if (lowered && lowered !== normalizedIdentifier) candidates.add(lowered);

        const orFilters = Array.from(candidates)
          .map(value => {
            const safe = value.replace(/[,]/g, '');
            return [`phone.eq.${safe}`, `email.eq.${safe}`];
          })
          .flat()
          .join(',');

        if (orFilters.length > 0) {
          query = query.or(orFilters);
        }
      } else {
        query = query.or(`email.eq.${normalizedIdentifier},phone.eq.${normalizedIdentifier}`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(5);

      const records = (data as StoredOTPRecord[] | null) || [];

      if (error || records.length === 0) {
        logger.info('OTP verification failed: not found or expired', {
          identifier,
          purpose,
          channel
        });
        return { valid: false, expired: true };
      }

      const matchingRecord = records.find(row => row.otp === otp || row.otp_code === otp);

      if (!matchingRecord) {
        logger.info('OTP verification failed: value mismatch', {
          identifier,
          purpose,
          channel,
          sampleRecord: records[0]?.id
        });
        return { valid: false };
      }

      const otpId = matchingRecord.id;
      if (otpId) {
        const { data: updatedRecord, error: updateError } = await (this.supabase! as any)
          .from('otp_codes')
          .update({ used: true })
          .eq('id', otpId)
          .eq('used', false)
          .select();

        if (updateError || !updatedRecord || updatedRecord.length === 0) {
          logger.error('OTP verification failed: already used or concurrent update', {
            otpId,
            identifier
          });
          return { valid: false };
        }
      }

      logger.info('OTP verified successfully', {
        identifier,
        purpose,
        channel: (matchingRecord as any).channel
      });

      return { valid: true };

    } catch (error) {
      logger.error('Error verifying OTP:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { valid: false };
    }
  }
}

// Export singleton instance
export const dualChannelOTPManager = new DualChannelOTPManager();
export default dualChannelOTPManager;