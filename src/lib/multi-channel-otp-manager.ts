import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { logger } from './logger';
import { sendInfobipWhatsAppOtp } from './infobip/infobip-whatsapp-otp';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

if (!supabase) {
  logger.warn('Supabase environment variables missing; using in-memory OTP storage fallback');
}

interface InMemoryOTPRecord {
  id: string;
  code: string;
  phone?: string;
  email?: string;
  purpose: OTPPurpose;
  channel: OTPChannel;
  attempts: number;
  max_attempts: number;
  verified: boolean;
  expires_at: string;
  user_id?: string;
  order_id?: string;
  fallback_channels: OTPChannel[];
  created_at: string;
  last_attempt_at?: string;
  verified_at?: string;
}

const inMemoryOTPStore = new Map<string, InMemoryOTPRecord>();

export type OTPChannel = 'whatsapp' | 'email';
export type OTPPurpose = 'login' | 'registration' | 'password_reset' | 'transaction' | 'agent_order';

export interface OTPRequest {
  phone?: string;
  email?: string;
  purpose: OTPPurpose;
  preferredChannel?: OTPChannel;
  enforcePreferredChannel?: boolean;
  userId?: string;
  orderId?: string;
}

export interface OTPVerification {
  otpId: string;
  code: string;
  channel?: OTPChannel;
}

export interface OTPRecord {
  id: string;
  code: string;
  phone?: string;
  email?: string;
  purpose: OTPPurpose;
  channel: OTPChannel;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
  expiresAt: Date;
  createdAt: Date;
  userId?: string;
  orderId?: string;
  fallbackChannels: OTPChannel[];
  lastAttemptAt?: Date;
}

type ChannelSendSuccess = {
  success: true;
  provider: string;
  providerMessageId?: string;
  raw?: any;
};

class MultiChannelOTPManager {
  private emailTransporter: nodemailer.Transporter;
  
  constructor() {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private generateOTPCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private async sendEmailOTP(email: string, code: string, purpose: string): Promise<ChannelSendSuccess> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@tecbunny.com',
        to: email,
        subject: `Your ${purpose.replace('_', ' ').toUpperCase()} Verification Code`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a; margin-bottom: 16px;">Verification Code</h2>
            <p style="color: #475569; font-size: 16px;">Your verification code is: <strong style="font-size: 24px; color: #4f46e5; letter-spacing: 2px;">${code}</strong></p>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">This code is valid for 5 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `
      };
      const result = await this.emailTransporter.sendMail(mailOptions);
      if (!result.messageId) throw new Error('Email send failed');
      return { success: true, provider: 'smtp', providerMessageId: result.messageId, raw: result };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Email send failed');
    }
  }

  private async sendWhatsAppOTP(phone: string, code: string, purpose: string): Promise<ChannelSendSuccess> {
    const purposeText = purpose.replace('_', ' ');
    const infobipResult = await sendInfobipWhatsAppOtp(phone, code, 'Customer', code);
    if (infobipResult.success) {
      return { 
        success: true, 
        provider: 'infobip-whatsapp', 
        providerMessageId: infobipResult.messageId, 
        raw: infobipResult.raw 
      };
    }
    throw new Error(infobipResult.error || 'WhatsApp send failed');
  }

  private async sendOTPViaChannel(channel: OTPChannel, phone: string | undefined, email: string | undefined, code: string, purpose: string): Promise<any> {
    if (channel === 'email') return await this.sendEmailOTP(email!, code, purpose);
    if (channel === 'whatsapp') return await this.sendWhatsAppOTP(phone!, code, purpose);
    throw new Error(`Unsupported channel: ${channel}`);
  }

  async generateOTP(request: OTPRequest): Promise<{ success: boolean; otpId?: string; channel?: OTPChannel; message?: string; fallbackAvailable?: boolean; provider?: string; providerMessageId?: string; providerResponse?: any }> {
    try {
      const code = this.generateOTPCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const hasPhone = !!request.phone;
      const hasEmail = !!request.email;
      
      let preferredChannel = request.preferredChannel;
      if (!preferredChannel) {
        if (hasPhone) preferredChannel = 'whatsapp';
        else if (hasEmail) preferredChannel = 'email';
        else throw new Error('No contact method available');
      }

      const supabaseClient = supabase;
      let otpId: string;

      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('otp_verifications')
          .insert([{
            code,
            phone: request.phone,
            email: request.email,
            purpose: request.purpose,
            channel: preferredChannel,
            attempts: 0,
            max_attempts: 3,
            verified: false,
            expires_at: expiresAt.toISOString(),
            user_id: request.userId,
            order_id: request.orderId,
            fallback_channels: [],
            created_at: new Date().toISOString()
          }])
          .select().single();
        if (error) throw new Error(error.message);
        otpId = data.id;
      } else {
        otpId = randomUUID();
        inMemoryOTPStore.set(otpId, {
          id: otpId, code, phone: request.phone, email: request.email, purpose: request.purpose,
          channel: preferredChannel, attempts: 0, max_attempts: 3, verified: false,
          expires_at: expiresAt.toISOString(), user_id: request.userId, order_id: request.orderId,
          fallback_channels: [], created_at: new Date().toISOString()
        });
      }

      const primaryResult = await this.sendOTPViaChannel(preferredChannel, request.phone, request.email, code, request.purpose);
      if (!primaryResult.success) {
        throw new Error(primaryResult.error || 'Failed to send OTP');
      }

      return {
        success: true,
        otpId,
        channel: preferredChannel,
        message: `Sent via ${preferredChannel}`,
        fallbackAvailable: false,
        provider: primaryResult.provider,
        providerMessageId: primaryResult.providerMessageId,
        providerResponse: primaryResult.raw
      };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async verifyOTP(verification: OTPVerification): Promise<{ success: boolean; message?: string; canRetry?: boolean; suggestFallback?: boolean; nextFallbackChannel?: OTPChannel }> {
    try {
      const supabaseClient = supabase;
      if (!supabaseClient) {
        const otpRecord = inMemoryOTPStore.get(verification.otpId);
        if (!otpRecord) return { success: false, message: 'Invalid OTP ID' };
        if (new Date(otpRecord.expires_at) < new Date()) return { success: false, message: 'OTP has expired' };
        if (otpRecord.verified) return { success: false, message: 'OTP already used' };
        
        if (otpRecord.attempts >= otpRecord.max_attempts) {
          return { success: false, message: 'Maximum verification attempts exceeded.', canRetry: false };
        }

        if (otpRecord.code !== verification.code) {
          const newAttempts = otpRecord.attempts + 1;
          otpRecord.attempts = newAttempts;
          inMemoryOTPStore.set(verification.otpId, otpRecord);
          return { success: false, message: `Invalid OTP. ${otpRecord.max_attempts - newAttempts} attempts remaining.`, canRetry: true };
        }

        otpRecord.verified = true;
        otpRecord.verified_at = new Date().toISOString();
        inMemoryOTPStore.set(verification.otpId, otpRecord);
        return { success: true, message: 'OTP verified successfully' };
      }

      // Supabase verification path
      const { data: otpRecord, error } = await supabaseClient
        .from('otp_verifications')
        .select('*')
        .eq('id', verification.otpId)
        .single();

      if (error || !otpRecord) return { success: false, message: 'Invalid OTP ID' };
      if (new Date(otpRecord.expires_at) < new Date()) return { success: false, message: 'OTP has expired' };
      if (otpRecord.verified) return { success: false, message: 'OTP already used' };

      if (otpRecord.attempts >= otpRecord.max_attempts) {
        return { success: false, message: 'Maximum verification attempts exceeded.', canRetry: false };
      }

      if (otpRecord.code !== verification.code) {
        const newAttempts = otpRecord.attempts + 1;
        await supabaseClient.from('otp_verifications').update({ attempts: newAttempts, last_attempt_at: new Date().toISOString() }).eq('id', verification.otpId);
        return { success: false, message: `Invalid OTP. ${otpRecord.max_attempts - newAttempts} attempts remaining.`, canRetry: true };
      }

      const { data: updatedRecord, error: updateError } = await supabaseClient
        .from('otp_verifications')
        .update({ verified: true, verified_at: new Date().toISOString() })
        .eq('id', verification.otpId)
        .eq('verified', false)
        .select();

      if (updateError || !updatedRecord || updatedRecord.length === 0) {
        return { success: false, message: 'OTP already verified or session expired.' };
      }
      return { success: true, message: 'OTP verified successfully' };
    } catch (error) {
      return { success: false, message: 'Verification failed' };
    }
  }

  async resendOTPWithFallback(otpId: string, fallbackChannel: OTPChannel): Promise<any> {
    try {
      const supabaseClient = supabase;
      if (!supabaseClient) {
        const otpRecord = inMemoryOTPStore.get(otpId);
        if (!otpRecord) return { success: false, message: 'Invalid OTP ID' };
        
        const newCode = this.generateOTPCode();
        const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const result = await this.sendOTPViaChannel(fallbackChannel, otpRecord.phone, otpRecord.email, newCode, otpRecord.purpose);
        if (!result.success) return { success: false, message: result.error };

        otpRecord.code = newCode;
        otpRecord.channel = fallbackChannel;
        otpRecord.attempts = 0;
        otpRecord.expires_at = newExpiresAt.toISOString();
        inMemoryOTPStore.set(otpId, otpRecord);
        return { success: true, message: `OTP resent via ${fallbackChannel}`, channel: fallbackChannel, provider: result.provider, providerMessageId: result.providerMessageId };
      }

      const { data: otpRecord, error } = await supabaseClient.from('otp_verifications').select('*').eq('id', otpId).single();
      if (error || !otpRecord) return { success: false, message: 'Invalid OTP ID' };

      const newCode = this.generateOTPCode();
      const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const result = await this.sendOTPViaChannel(fallbackChannel, otpRecord.phone, otpRecord.email, newCode, otpRecord.purpose);
      if (!result.success) return { success: false, message: result.error };

      await supabaseClient.from('otp_verifications').update({ code: newCode, channel: fallbackChannel, attempts: 0, expires_at: newExpiresAt.toISOString(), created_at: new Date().toISOString() }).eq('id', otpId);
      return { success: true, message: `OTP resent via ${fallbackChannel}`, channel: fallbackChannel, provider: result.provider, providerMessageId: result.providerMessageId };
    } catch (error) {
      return { success: false, message: 'Failed to resend OTP' };
    }
  }

  async getOTPStatus(otpId: string): Promise<any> {
    try {
      const supabaseClient = supabase;
      if (!supabaseClient) {
        const otpRecord = inMemoryOTPStore.get(otpId);
        if (!otpRecord) return { success: false };
        return { success: true, otpRecord, availableFallbacks: [], canResend: !otpRecord.verified && new Date(otpRecord.expires_at) > new Date() };
      }

      const { data: otpRecord, error } = await supabaseClient.from('otp_verifications').select('*').eq('id', otpId).single();
      if (error || !otpRecord) return { success: false };
      return { success: true, otpRecord, availableFallbacks: [], canResend: !otpRecord.verified && new Date(otpRecord.expires_at) > new Date() };
    } catch (error) {
      return { success: false };
    }
  }
}

export default MultiChannelOTPManager;
