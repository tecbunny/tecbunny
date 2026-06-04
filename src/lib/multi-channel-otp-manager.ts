import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

import { logger } from './logger';
import { sendOTP } from './sms/twofactor';

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

export type OTPChannel = 'sms' | 'email' | 'whatsapp';
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

type ChannelSendFailure = {
  success: false;
  error: string;
};

type ChannelSendResult = ChannelSendSuccess | ChannelSendFailure;

class MultiChannelOTPManager {
  private emailTransporter: nodemailer.Transporter;
  private isInfobipWhatsAppConfigured(): boolean {
    return Boolean(
      process.env.INFOBIP_API_KEY &&
      process.env.INFOBIP_BASE_URL &&
      process.env.INFOBIP_WHATSAPP_FROM &&
      process.env.INFOBIP_WHATSAPP_TEMPLATE_NAME
    ) || Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID
    );
  }
  
  constructor() {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private generateOTPCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private determineFallbackChannels(
    preferredChannel: OTPChannel,
    hasPhone: boolean,
    hasEmail: boolean
  ): OTPChannel[] {
    const availableChannels: OTPChannel[] = [];
    if (hasPhone) availableChannels.push('sms');
    if (hasEmail) availableChannels.push('email');
    if (hasPhone && this.isInfobipWhatsAppConfigured()) {
      availableChannels.push('whatsapp');
    }

    const fallbackOrder: OTPChannel[] = ['sms', 'email', 'whatsapp'];
    const remainingChannels = availableChannels.filter(channel => channel !== preferredChannel);
    return fallbackOrder.filter(channel => remainingChannels.includes(channel));
  }

  private async sendSMSOTP(phone: string, code: string, purpose: string): Promise<ChannelSendSuccess> {
    const sanitizedCode = code.replace(/\D/g, '').slice(0, 4);
    if (sanitizedCode.length !== 4) {
      throw new Error('2Factor requires exactly 4-digit OTP for SMS delivery');
    }
    const result = await sendOTP({ to: phone, otp: sanitizedCode });
    if (!result.success) {
      throw new Error(result.error || 'SMS send failed');
    }
    return { success: true, provider: '2factor', providerMessageId: result.id, raw: result.raw };
  }

  private async sendEmailOTP(email: string, code: string, purpose: string): Promise<ChannelSendSuccess> {
    try {
      const infobipApiKey = process.env.INFOBIP_API_KEY;
      const infobipBaseUrl = process.env.INFOBIP_BASE_URL;
      const infobipSender = process.env.INFOBIP_EMAIL_FROM;
      const infobipReplyTo = process.env.INFOBIP_EMAIL_REPLY_TO;
      if (infobipApiKey && infobipBaseUrl && infobipSender) {
        return await this.sendInfobipEmailOTP(email, code, purpose, infobipApiKey, infobipBaseUrl, infobipSender, infobipReplyTo);
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@tecbunny.com',
        to: email,
        subject: `Your ${purpose.replace('_', ' ').toUpperCase()} Verification Code`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verification Code</h2>
            <p>Your verification code is: <strong>${code}</strong></p>
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

  private async sendInfobipEmailOTP(email: string, code: string, purpose: string, apiKey: string, baseUrl: string, sender: string, replyTo?: string): Promise<ChannelSendSuccess> {
    const normalizedBaseUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
    const endpoint = `${normalizedBaseUrl.replace(/\/$/, '')}/email/4/messages`;
    const payload: any = {
      messages: [{
        sender,
        destinations: [{ to: [{ destination: email }] }],
        content: {
          subject: `Your ${purpose.replace('_', ' ').toUpperCase()} Verification Code`,
          text: `Your code is ${code}`,
          html: `<p>Your code is <b>${code}</b></p>`
        }
      }]
    };
    if (replyTo) payload.messages[0].replyTo = replyTo;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `App ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.message || 'Email send failed');
    return { success: true, provider: 'infobip-email', providerMessageId: result?.messages?.[0]?.messageId, raw: result };
  }

  private async sendWhatsAppOTP(phone: string, code: string, purpose: string): Promise<ChannelSendSuccess> {
    const { whatsappOTPService } = await import('./whatsapp/whatsapp-otp-service');
    if (await whatsappOTPService.isConfigured()) {
      const result = await whatsappOTPService.sendOTP(phone, code, purpose, 'Customer');
      if (result.success) return { success: true, provider: result.provider, providerMessageId: result.messageId };
      throw new Error(result.error || 'WhatsApp send failed');
    }
    const { sendInfobipWhatsAppOtp } = await import('./infobip/infobip-whatsapp-otp');
    const infobipResult = await sendInfobipWhatsAppOtp(phone, code, 'Customer', code);
    if (infobipResult.success) return { success: true, provider: 'infobip-whatsapp', providerMessageId: infobipResult.messageId, raw: infobipResult.raw };
    throw new Error(infobipResult.error || 'WhatsApp send failed');
  }

  private async sendOTPViaChannel(channel: OTPChannel, phone: string | undefined, email: string | undefined, code: string, purpose: string): Promise<ChannelSendResult> {
    try {
      if (channel === 'sms') return await this.sendSMSOTP(phone!, code, purpose);
      if (channel === 'email') return await this.sendEmailOTP(email!, code, purpose);
      if (channel === 'whatsapp') return await this.sendWhatsAppOTP(phone!, code, purpose);
      throw new Error(`Unsupported channel: ${channel}`);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async generateOTP(request: OTPRequest): Promise<{ success: boolean; otpId?: string; channel?: OTPChannel; message?: string; fallbackAvailable?: boolean; provider?: string; providerMessageId?: string; providerResponse?: any }> {
    try {
      const code = this.generateOTPCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const hasPhone = !!request.phone;
      const hasEmail = !!request.email;
      
      let preferredChannel = request.preferredChannel;
      let enforcePreferredChannel = Boolean(request.enforcePreferredChannel);
      if (!preferredChannel) {
        if (hasPhone) preferredChannel = 'sms';
        else if (hasEmail) preferredChannel = 'email';
        else throw new Error('No contact method available');
      }

      if (preferredChannel === 'whatsapp' && !this.isInfobipWhatsAppConfigured()) {
        preferredChannel = hasPhone ? 'sms' : 'email';
        enforcePreferredChannel = false;
      }

      const fallbackChannels = enforcePreferredChannel ? [] : this.determineFallbackChannels(preferredChannel, hasPhone, hasEmail);
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
            fallback_channels: fallbackChannels,
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
          fallback_channels: fallbackChannels, created_at: new Date().toISOString()
        });
      }

      const primaryResult = await this.sendOTPViaChannel(preferredChannel, request.phone, request.email, code, request.purpose);
      if (!primaryResult.success) {
        if (enforcePreferredChannel) throw new Error(primaryResult.error);
        for (const fallback of fallbackChannels) {
          const fallbackResult = await this.sendOTPViaChannel(fallback, request.phone, request.email, code, request.purpose);
          if (fallbackResult.success) {
            if (supabaseClient) {
              await supabaseClient.from('otp_verifications').update({ channel: fallback }).eq('id', otpId);
            } else {
              const rec = inMemoryOTPStore.get(otpId);
              if (rec) { rec.channel = fallback; inMemoryOTPStore.set(otpId, rec); }
            }
            return {
              success: true, otpId, channel: fallback, message: `Sent via ${fallback} (fallback)`,
              fallbackAvailable: fallbackChannels.filter(c => c !== fallback).length > 0,
              provider: fallbackResult.provider, providerMessageId: fallbackResult.providerMessageId, providerResponse: fallbackResult.raw
            };
          }
        }
        throw new Error('All channels failed');
      }

      return {
        success: true, otpId, channel: preferredChannel, message: `Sent via ${preferredChannel}`,
        fallbackAvailable: fallbackChannels.length > 0, provider: primaryResult.provider,
        providerMessageId: primaryResult.providerMessageId, providerResponse: primaryResult.raw
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
        
        // Check if attempts limit is already exhausted
        if (otpRecord.attempts >= otpRecord.max_attempts) {
          return { success: false, message: 'Maximum verification attempts exceeded. Please request a new code.', canRetry: false };
        }

        if (otpRecord.code !== verification.code) {
          const newAttempts = otpRecord.attempts + 1;
          otpRecord.attempts = newAttempts;
          inMemoryOTPStore.set(verification.otpId, otpRecord);

          if (newAttempts >= otpRecord.max_attempts) {
            const nextFallback = otpRecord.fallback_channels.find(c => c !== otpRecord.channel);
            return {
              success: false, message: 'Maximum attempts reached', canRetry: false,
              suggestFallback: !!nextFallback, nextFallbackChannel: nextFallback
            };
          }
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

      // Check if attempts limit is already exhausted
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        return { success: false, message: 'Maximum verification attempts exceeded. Please request a new code.', canRetry: false };
      }

      if (otpRecord.code !== verification.code) {
        const newAttempts = otpRecord.attempts + 1;
        await supabaseClient.from('otp_verifications').update({ attempts: newAttempts, last_attempt_at: new Date().toISOString() }).eq('id', verification.otpId);

        if (newAttempts >= otpRecord.max_attempts) {
          const fallbackChannels = otpRecord.fallback_channels as OTPChannel[];
          const nextFallback = fallbackChannels.find(c => c !== otpRecord.channel);
          return {
            success: false, message: 'Maximum attempts reached', canRetry: false,
            suggestFallback: !!nextFallback, nextFallbackChannel: nextFallback
          };
        }
        return { success: false, message: `Invalid OTP. ${otpRecord.max_attempts - newAttempts} attempts remaining.`, canRetry: true };
      }

      // Atomically update verified to true where verified was false
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

  async resendOTPWithFallback(otpId: string, fallbackChannel: OTPChannel): Promise<{ success: boolean; message?: string; channel?: OTPChannel; provider?: string; providerMessageId?: string; providerResponse?: any }> {
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
        return { success: true, message: `OTP resent via ${fallbackChannel}`, channel: fallbackChannel, provider: result.provider, providerMessageId: result.providerMessageId, providerResponse: result.raw };
      }

      const { data: otpRecord, error } = await supabaseClient.from('otp_verifications').select('*').eq('id', otpId).single();
      if (error || !otpRecord) return { success: false, message: 'Invalid OTP ID' };

      const newCode = this.generateOTPCode();
      const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const result = await this.sendOTPViaChannel(fallbackChannel, otpRecord.phone, otpRecord.email, newCode, otpRecord.purpose);
      if (!result.success) return { success: false, message: result.error };

      await supabaseClient.from('otp_verifications').update({ code: newCode, channel: fallbackChannel, attempts: 0, expires_at: newExpiresAt.toISOString(), created_at: new Date().toISOString() }).eq('id', otpId);
      return { success: true, message: `OTP resent via ${fallbackChannel}`, channel: fallbackChannel, provider: result.provider, providerMessageId: result.providerMessageId, providerResponse: result.raw };
    } catch (error) {
      return { success: false, message: 'Failed to resend OTP' };
    }
  }

  async getOTPStatus(otpId: string): Promise<{ success: boolean; otpRecord?: any; availableFallbacks?: OTPChannel[]; canResend?: boolean }> {
    try {
      const supabaseClient = supabase;
      if (!supabaseClient) {
        const otpRecord = inMemoryOTPStore.get(otpId);
        if (!otpRecord) return { success: false };
        const availableFallbacks = otpRecord.fallback_channels.filter(c => c !== otpRecord.channel);
        return { success: true, otpRecord, availableFallbacks, canResend: !otpRecord.verified && new Date(otpRecord.expires_at) > new Date() };
      }

      const { data: otpRecord, error } = await supabaseClient.from('otp_verifications').select('*').eq('id', otpId).single();
      if (error || !otpRecord) return { success: false };
      const fallbackChannels = otpRecord.fallback_channels as OTPChannel[];
      const availableFallbacks = fallbackChannels.filter(c => c !== otpRecord.channel);
      return { success: true, otpRecord, availableFallbacks, canResend: !otpRecord.verified && new Date(otpRecord.expires_at) > new Date() };
    } catch (error) {
      return { success: false };
    }
  }
}

export default MultiChannelOTPManager;