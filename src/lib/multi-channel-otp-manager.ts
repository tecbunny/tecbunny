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
    // Initialize Nodemailer for email OTP
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Generate a 4-digit OTP code (2Factor template requirement)
   */
  private generateOTPCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Determine fallback channels based on preferred channel and available contact methods
   * Implements automatic fallback: SMS → Email → WhatsApp
   */
  private determineFallbackChannels(
    preferredChannel: OTPChannel,
    hasPhone: boolean,
    hasEmail: boolean
  ): OTPChannel[] {
    // Get all available channels
    const availableChannels: OTPChannel[] = [];
    
    if (hasPhone) availableChannels.push('sms');
    if (hasEmail) availableChannels.push('email');
    if (hasPhone && this.isInfobipWhatsAppConfigured()) {
      availableChannels.push('whatsapp'); // WhatsApp template 'otp2' is now active
    }

    // Define fallback order: SMS → Email → WhatsApp
    const fallbackOrder: OTPChannel[] = ['sms', 'email', 'whatsapp'];
    
    // Remove preferred channel from fallback options
    const remainingChannels = availableChannels.filter(channel => channel !== preferredChannel);
    
    // Sort remaining channels according to fallback order
    const sortedFallbacks = fallbackOrder.filter(channel => remainingChannels.includes(channel));
    
    return sortedFallbacks;
  }

  /**
   * Send SMS OTP using 2Factor API
   */
  private async sendSMSOTP(phone: string, code: string, purpose: string): Promise<ChannelSendSuccess> {
    // 2Factor OTP1 template expects 4-digit OTP
    const sanitizedCode = code.replace(/\D/g, '').slice(0, 4);
    if (sanitizedCode.length !== 4) {
      throw new Error('2Factor requires exactly 4-digit OTP for SMS delivery');
    }

    const sanitizedPurpose = purpose.replace(/_/g, ' ').trim();

    logger.debug('Sending SMS OTP via 2Factor transactional template', {
      phone,
      purpose: sanitizedPurpose,
      codeLength: sanitizedCode.length,
      sanitizedCode
    });

    const result = await sendOTP({
      to: phone,
      otp: sanitizedCode
    });

    if (!result.success) {
      const errorMessage = result.error || 'SMS send failed';
      logger.error('SMS OTP sending failed', {
        phone,
        error: errorMessage,
        raw: result.raw,
        status: result.status
      });
      throw new Error(errorMessage);
    }

    logger.info('SMS OTP sent successfully', {
      phone,
      provider: '2factor',
      providerMessageId: result.id,
      response: result.raw
    });

    return {
      success: true,
      provider: '2factor',
      providerMessageId: result.id,
      raw: result.raw
    };
  }

  /**
   * Send Email OTP using Nodemailer
   */
  private async sendEmailOTP(email: string, code: string, purpose: string): Promise<ChannelSendSuccess> {
    try {
      const infobipApiKey = process.env.INFOBIP_API_KEY;
      const infobipBaseUrl = process.env.INFOBIP_BASE_URL;
      const infobipSender = process.env.INFOBIP_EMAIL_FROM;
      const infobipReplyTo = process.env.INFOBIP_EMAIL_REPLY_TO;
      if (infobipApiKey && infobipBaseUrl && infobipSender) {
        return await this.sendInfobipEmailOTP(
          email,
          code,
          purpose,
          infobipApiKey,
          infobipBaseUrl,
          infobipSender,
          infobipReplyTo
        );
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@tecbunny.com',
        to: email,
        subject: `Your ${purpose.replace('_', ' ').toUpperCase()} Verification Code`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verification Code</h2>
            <p>Your verification code for ${purpose.replace('_', ' ')} is:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 36px; margin: 0; letter-spacing: 5px;">${code}</h1>
            </div>
            <p style="color: #666;">
              This code is valid for 5 minutes. Do not share this code with anyone.
            </p>
            <hr style="margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      if (!result.messageId) {
        throw new Error('Email send failed');
      }

      logger.info('Email OTP sent successfully', { email });
      return {
        success: true,
        provider: 'smtp',
        providerMessageId: result.messageId,
        raw: result
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Email send failed';
      logger.error('Email OTP sending failed', { email, error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  /**
   * Send Email OTP using Infobip Email API (V4)
   */
  private async sendInfobipEmailOTP(
    email: string,
    code: string,
    purpose: string,
    apiKey: string,
    baseUrl: string,
    sender: string,
    replyTo?: string
  ): Promise<ChannelSendSuccess> {
    const normalizedBaseUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
    const endpoint = `${normalizedBaseUrl.replace(/\/$/, '')}/email/4/messages`;
    const subject = `Your ${purpose.replace('_', ' ').toUpperCase()} Verification Code`;
    const textBody = `Your verification code for ${purpose.replace('_', ' ')} is: ${code}. This code is valid for 5 minutes.`;
    const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verification Code</h2>
            <p>Your verification code for ${purpose.replace('_', ' ')} is:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 36px; margin: 0; letter-spacing: 5px;">${code}</h1>
            </div>
            <p style="color: #666;">
              This code is valid for 5 minutes. Do not share this code with anyone.
            </p>
            <hr style="margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `;

    const payload: any = {
      messages: [
        {
          sender,
          destinations: [
            {
              to: [{ destination: email }]
            }
          ],
          content: {
            subject,
            text: textBody,
            html: htmlBody
          }
        }
      ]
    };

    if (replyTo) {
      payload.messages[0].replyTo = replyTo;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `App ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMessage = result?.requestError?.serviceException?.text || result?.message || `HTTP ${response.status}`;
      logger.error('Infobip Email OTP send failed', { email, status: response.status, response: result });
      throw new Error(errorMessage);
    }

    const messageId = result?.messages?.[0]?.messageId;
    if (!messageId) {
      logger.error('Infobip Email OTP missing messageId', { email, response: result });
      throw new Error('Email send failed');
    }

    logger.info('Infobip Email OTP sent successfully', { email, messageId });
    return {
      success: true,
      provider: 'infobip-email',
      providerMessageId: messageId,
      raw: result
    };
  }

  /**
   * Send WhatsApp OTP using Infobip template message
   */
  private async sendWhatsAppOTP(phone: string, code: string, purpose: string): Promise<ChannelSendSuccess> {
    try {
      // Check if unified whatsappOTPService is configured
      const { whatsappOTPService } = await import('./whatsapp/whatsapp-otp-service');
      if (await whatsappOTPService.isConfigured()) {
        const result = await whatsappOTPService.sendOTP(phone, code, purpose, 'Customer');
        if (result.success) {
          logger.info('WhatsApp OTP sent successfully via unified WhatsApp OTP Service', { phone });
          return {
            success: true,
            provider: result.provider,
            providerMessageId: result.messageId
          };
        }
        throw new Error(result.error || 'WhatsApp send failed via unified service');
      }

      // Fallback to legacy sendInfobipWhatsAppOtp
      const { sendInfobipWhatsAppOtp } = await import('./infobip/infobip-whatsapp-otp');
      const infobipResult = await sendInfobipWhatsAppOtp(phone, code, 'Customer', code);

      if (infobipResult.success) {
        logger.info('WhatsApp OTP sent successfully via Infobip (legacy)', { phone });
        return {
          success: true,
          provider: 'infobip-whatsapp',
          providerMessageId: infobipResult.messageId,
          raw: infobipResult.raw
        };
      }
      const errorMessage = infobipResult.error || 'WhatsApp send failed';
      throw new Error(errorMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WhatsApp OTP sending failed', {
        phone,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * Send OTP via specified channel
   */
  private async sendOTPViaChannel(
    channel: OTPChannel,
    phone: string | undefined,
    email: string | undefined,
    code: string,
    purpose: string
  ): Promise<ChannelSendResult> {
    try {
      switch (channel) {
        case 'sms':
          if (!phone) {
            throw new Error('Phone number is required for SMS channel');
          }
          return await this.sendSMSOTP(phone, code, purpose);

        case 'email':
          if (!email) {
            throw new Error('Email address is required for email channel');
          }
          return await this.sendEmailOTP(email, code, purpose);

        case 'whatsapp':
          if (!phone) {
            throw new Error('Phone number is required for WhatsApp channel');
          }
          return await this.sendWhatsAppOTP(phone, code, purpose);

        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error);
      logger.warn('OTP channel delivery failed', { channel, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Generate and send OTP
   */
  async generateOTP(request: OTPRequest): Promise<{
    success: boolean;
    otpId?: string;
    channel?: OTPChannel;
    message?: string;
    fallbackAvailable?: boolean;
    provider?: string;
    providerMessageId?: string;
    providerResponse?: any;
  }> {
    try {
      const code = this.generateOTPCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      // Determine preferred channel
      const hasPhone = !!request.phone;
      const hasEmail = !!request.email;
      
      let preferredChannel = request.preferredChannel;
      let enforcePreferredChannel = Boolean(request.enforcePreferredChannel);
      if (!preferredChannel) {
        // Auto-select based on available contact methods
        if (hasPhone) preferredChannel = 'sms';
        else if (hasEmail) preferredChannel = 'email';
        else throw new Error('No contact method available');
      }

      if (preferredChannel === 'whatsapp' && !this.isInfobipWhatsAppConfigured()) {
        logger.warn('WhatsApp OTP requested but Infobip config missing; falling back', {
          hasPhone,
          hasEmail
        });
        preferredChannel = hasPhone ? 'sms' : 'email';
        enforcePreferredChannel = false;
      }

      // Validate channel availability
      if (preferredChannel === 'sms' && !hasPhone) {
        throw new Error('SMS channel requires phone number');
      }
      if (preferredChannel === 'email' && !hasEmail) {
        throw new Error('Email channel requires email address');
      }
      if (preferredChannel === 'whatsapp' && !hasPhone) {
        throw new Error('WhatsApp channel requires phone number');
      }

      const fallbackChannels = enforcePreferredChannel
        ? []
        : this.determineFallbackChannels(preferredChannel, hasPhone, hasEmail);

      const supabaseClient = supabase;
      let otpRecord: any;
      let otpId: string;

      if (supabaseClient) {
        // Store OTP in Supabase
        const { data, error: dbError } = await supabaseClient
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
          .select()
          .single();

        if (dbError) {
          throw new Error(`Database error: ${dbError.message}`);
        }

        otpRecord = data;
        otpId = otpRecord.id;
      } else {
        // In-memory fallback storage
        otpId = randomUUID();
        otpRecord = {
          id: otpId,
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
        } satisfies InMemoryOTPRecord;

        inMemoryOTPStore.set(otpId, otpRecord);
      }

      const deliveryErrors: Array<{ channel: OTPChannel; error: string }> = [];

      // Send OTP via preferred channel
      const primaryResult = await this.sendOTPViaChannel(
        preferredChannel,
        request.phone,
        request.email,
        code,
        request.purpose
      );

      if (!primaryResult.success) {
        const primaryError = primaryResult.error || 'Unknown error';
        deliveryErrors.push({ channel: preferredChannel, error: primaryError });

        if (enforcePreferredChannel) {
          throw new Error(`Failed to send OTP via ${preferredChannel}: ${primaryError}`);
        }

        for (const fallbackChannel of fallbackChannels) {
          const fallbackResult = await this.sendOTPViaChannel(
            fallbackChannel,
            request.phone,
            request.email,
            code,
            request.purpose
          );

          if (fallbackResult.success) {
            if (supabaseClient) {
              await supabaseClient
                .from('otp_verifications')
                .update({ channel: fallbackChannel })
                .eq('id', otpRecord.id);
            } else {
              const existing = inMemoryOTPStore.get(otpId);
              if (existing) {
                existing.channel = fallbackChannel;
                existing.last_attempt_at = new Date().toISOString();
                inMemoryOTPStore.set(otpId, existing);
              }
            }

            return {
              success: true,
              otpId,
              channel: fallbackChannel,
              message: `OTP sent via ${fallbackChannel} (fallback)`,
              fallbackAvailable: fallbackChannels.filter(channel => channel !== fallbackChannel).length > 0,
              provider: fallbackResult.provider,
              providerMessageId: fallbackResult.providerMessageId,
              providerResponse: fallbackResult.raw
            };
          }

          deliveryErrors.push({ channel: fallbackChannel, error: fallbackResult.error || 'Unknown error' });
        }

        const errorSummary = deliveryErrors
          .map(entry => `${entry.channel}: ${entry.error}`)
          .join('; ');
        throw new Error(`Failed to send OTP via any channel (${errorSummary})`);
      }

      return {
        success: true,
        otpId,
        channel: preferredChannel,
        message: `OTP sent via ${preferredChannel}`,
        fallbackAvailable: fallbackChannels.length > 0,
        provider: primaryResult.provider,
        providerMessageId: primaryResult.providerMessageId,
        providerResponse: primaryResult.raw
      };

    } catch (error) {
      logger.error('OTP generation failed', { error, request });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Verify OTP with automatic fallback handling
   */
  async verifyOTP(verification: OTPVerification): Promise<{
    success: boolean;
    message?: string;
    canRetry?: boolean;
    suggestFallback?: boolean;
    nextFallbackChannel?: OTPChannel;
  }> {
    try {
      const supabaseClient = supabase;

      if (!supabaseClient) {
        const otpRecord = inMemoryOTPStore.get(verification.otpId);

        if (!otpRecord) {
          return { success: false, message: 'Invalid OTP ID' };
        }

        if (new Date(otpRecord.expires_at) < new Date()) {
          return { success: false, message: 'OTP has expired' };
        }

        if (otpRecord.verified) {
          return { success: false, message: 'OTP already used' };
        }

        if (otpRecord.code !== verification.code) {
          const newAttempts = otpRecord.attempts + 1;
          otpRecord.attempts = newAttempts;
          otpRecord.last_attempt_at = new Date().toISOString();
          inMemoryOTPStore.set(verification.otpId, otpRecord);

          if (newAttempts >= otpRecord.max_attempts) {
            const nextFallback = otpRecord.fallback_channels.find(channel => channel !== otpRecord.channel);
            if (nextFallback) {
              return {
                success: false,
                message: 'Maximum attempts reached',
                canRetry: false,
                suggestFallback: true,
                nextFallbackChannel: nextFallback
              };
            }

            return {
              success: false,
              message: 'Maximum attempts reached. No fallback available.',
              canRetry: false
            };
          }

          return {
            success: false,
            message: `Invalid OTP. ${otpRecord.max_attempts - newAttempts} attempts remaining.`,
            canRetry: true
          };
        }

        otpRecord.verified = true;
        otpRecord.verified_at = new Date().toISOString();
        inMemoryOTPStore.set(verification.otpId, otpRecord);

        return {
          success: true,
          message: 'OTP verified successfully'
        };
      }

      // Supabase-backed verification
      const { data: otpRecord, error: fetchError } = await supabaseClient
        .from('otp_verifications')
        .select('*')
        .eq('id', verification.otpId)
        .single();

      if (fetchError || !otpRecord) {
        return { success: false, message: 'Invalid OTP ID' };
      }

      if (new Date(otpRecord.expires_at) < new Date()) {
        return { success: false, message: 'OTP has expired' };
      }

      if (otpRecord.verified) {
        return { success: false, message: 'OTP already used' };
      }

      if (otpRecord.code !== verification.code) {
        const newAttempts = otpRecord.attempts + 1;

        await supabaseClient
          .from('otp_verifications')
          .update({
            attempts: newAttempts,
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', verification.otpId);

        if (newAttempts >= otpRecord.max_attempts) {
          const fallbackChannels = otpRecord.fallback_channels as OTPChannel[];
          const nextFallback = fallbackChannels.find(channel => channel !== otpRecord.channel);

          if (nextFallback) {
            return {
              success: false,
              message: 'Maximum attempts reached',
              canRetry: false,
              suggestFallback: true,
              nextFallbackChannel: nextFallback
            };
          }

          return {
            success: false,
            message: 'Maximum attempts reached. No fallback available.',
            canRetry: false
          };
        }

        return {
          success: false,
          message: `Invalid OTP. ${otpRecord.max_attempts - newAttempts} attempts remaining.`,
          canRetry: true
        };
      }

      await supabaseClient
        .from('otp_verifications')
        .update({
          verified: true,
          verified_at: new Date().toISOString()
        })
        .eq('id', verification.otpId);

      return {
        success: true,
        message: 'OTP verified successfully'
      };

    } catch (error) {
      logger.error('OTP verification failed', { error, verification });
      return {
        success: false,
        message: 'Verification failed'
      };
    }
  }

  /**
   * Resend OTP using fallback channel
   */
  async resendOTPWithFallback(otpId: string, fallbackChannel: OTPChannel): Promise<{
    success: boolean;
    message?: string;
    channel?: OTPChannel;
    provider?: string;
    providerMessageId?: string;
    providerResponse?: any;
  }> {
    try {
      const supabaseClient = supabase;

      if (!supabaseClient) {
        const otpRecord = inMemoryOTPStore.get(otpId);

        if (!otpRecord) {
          return { success: false, message: 'Invalid OTP ID' };
        }

        const newCode = this.generateOTPCode();
        const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const result = await this.sendOTPViaChannel(
          fallbackChannel,
          otpRecord.phone,
          otpRecord.email,
          newCode,
          otpRecord.purpose
        );

        if (!result.success) {
          return { success: false, message: `Failed to send OTP via ${fallbackChannel}: ${result.error || 'Unknown error'}` };
        }

        otpRecord.code = newCode;
        otpRecord.channel = fallbackChannel;
        otpRecord.attempts = 0;
        otpRecord.expires_at = newExpiresAt.toISOString();
        otpRecord.created_at = new Date().toISOString();
        otpRecord.last_attempt_at = undefined;
        inMemoryOTPStore.set(otpId, otpRecord);

        return {
          success: true,
          message: `OTP resent via ${fallbackChannel}`,
          channel: fallbackChannel,
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          providerResponse: result.raw
        };
      }

      const { data: otpRecord, error: fetchError } = await supabaseClient
        .from('otp_verifications')
        .select('*')
        .eq('id', otpId)
        .single();

      if (fetchError || !otpRecord) {
        return { success: false, message: 'Invalid OTP ID' };
      }

      const newCode = this.generateOTPCode();
      const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const result = await this.sendOTPViaChannel(
        fallbackChannel,
        otpRecord.phone,
        otpRecord.email,
        newCode,
        otpRecord.purpose
      );

      if (!result.success) {
        return { success: false, message: `Failed to send OTP via ${fallbackChannel}: ${result.error || 'Unknown error'}` };
      }

      await supabaseClient
        .from('otp_verifications')
        .update({
          code: newCode,
          channel: fallbackChannel,
          attempts: 0,
          expires_at: newExpiresAt.toISOString(),
          created_at: new Date().toISOString()
        })
        .eq('id', otpId);

      return {
        success: true,
        message: `OTP resent via ${fallbackChannel}`,
        channel: fallbackChannel,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        providerResponse: result.raw
      };

    } catch (error) {
      logger.error('OTP resend failed', { error, otpId, fallbackChannel });
      return {
        success: false,
        message: 'Failed to resend OTP'
      };
    }
  }

  /**
   * Get OTP status and available fallback options
   */
  async getOTPStatus(otpId: string): Promise<{
    success: boolean;
    otpRecord?: any;
    availableFallbacks?: OTPChannel[];
    canResend?: boolean;
  }> {
    try {
      const supabaseClient = supabase;

      if (!supabaseClient) {
        const otpRecord = inMemoryOTPStore.get(otpId);
        if (!otpRecord) {
          return { success: false };
        }

        const availableFallbacks = otpRecord.fallback_channels.filter(channel => channel !== otpRecord.channel);
        const canResend = !otpRecord.verified && new Date(otpRecord.expires_at) > new Date();

        return {
          success: true,
          otpRecord,
          availableFallbacks,
          canResend
        };
      }

      const { data: otpRecord, error } = await supabaseClient
        .from('otp_verifications')
        .select('*')
        .eq('id', otpId)
        .single();

      if (error || !otpRecord) {
        return { success: false };
      }

      const fallbackChannels = otpRecord.fallback_channels as OTPChannel[];
      const availableFallbacks = fallbackChannels.filter(channel => channel !== otpRecord.channel);
      const canResend = !otpRecord.verified && new Date(otpRecord.expires_at) > new Date();

      return {
        success: true,
        otpRecord,
        availableFallbacks,
        canResend
      };

    } catch (error) {
      logger.error('Get OTP status failed', { error, otpId });
      return { success: false };
    }
  }
}

export default MultiChannelOTPManager;