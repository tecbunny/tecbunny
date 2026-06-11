import { randomBytes, randomUUID, randomInt, createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { logger } from './logger';
import { getRedis } from './redis';
import { sendInfobipWhatsAppOtp } from './infobip/infobip-whatsapp-otp';
import improvedEmailService from './improved-email-service';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

if (!supabase) {
  logger.warn('Supabase environment variables missing; using in-memory OTP storage fallback');
}

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
  ipAddress?: string;
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

export interface OTPData {
  id: string;
  email: string;
  otp: string;
  expires_at: string;
  type: 'signup' | 'recovery';
  used: boolean;
  created_at: string;
}

export interface OTPInsertData {
  email: string;
  otp?: string;
  otp_code?: string;
  expires_at: string;
  type: 'signup' | 'recovery';
  used: boolean;
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
const legacyOtpStorage = new Map<string, { otp: string, type: string, expires: number, used: boolean }>();

/**
 * Distributed OTP fallback using Redis when Supabase is not available
 */
async function setDistributedOTP(id: string, record: InMemoryOTPRecord) {
  try {
    const redis = getRedis();
    if (redis) {
      await redis.set(`otp_verification:${id}`, JSON.stringify(record), 'EX', 600); // 10 min TTL
    } else {
      inMemoryOTPStore.set(id, record);
    }
  } catch (err) {
    logger.error('Failed to set distributed OTP', { error: err });
    inMemoryOTPStore.set(id, record);
  }
}

async function getDistributedOTP(id: string): Promise<InMemoryOTPRecord | undefined> {
  try {
    const redis = getRedis();
    if (redis) {
      const data = await redis.get(`otp_verification:${id}`);
      if (data) return JSON.parse(data) as InMemoryOTPRecord;
    }
  } catch (err) {
    logger.error('Failed to get distributed OTP', { error: err });
  }
  return inMemoryOTPStore.get(id);
}

type ChannelSendSuccess = {
  success: true;
  provider: string;
  providerMessageId?: string;
  raw?: any;
};

export async function assertOtpVelocity(phoneNumber: string, ipAddress: string = 'unknown') {
  const redis = getRedis();
  if (!redis) {
    logger.warn('Redis not available for assertOtpVelocity, skipping strict rate limits');
    return;
  }

  const phoneKey = `ratelimit:otp:phone:${phoneNumber}`;
  const ipKey = `ratelimit:otp:ip:${ipAddress}`;

  // 1. Enforce absolute 60-second delay per phone number
  const isThrottled = await redis.get(phoneKey);
  if (isThrottled) {
    throw new Error("Velocity limit hit: Please wait 60 seconds before requesting another code.");
  }

  // 2. Increment rolling 24-hour phone attempt window (Max 5 OTPs per day per number)
  const dailyTotal = await redis.incr(`otp:daily:${phoneNumber}`);
  if (dailyTotal === 1) {
    await redis.expire(`otp:daily:${phoneNumber}`, 86400); // 24 hours
  }
  if (dailyTotal > 5) {
    throw new Error("Security policy violation: Daily request threshold exceeded for this destination.");
  }

  // Set 60-second cooldown lock
  await redis.set(phoneKey, 'locked', 'EX', 60);
}

export class OTPManager {
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

  // Generate a secure 6-digit OTP code using CSPRNG
  generateOTPCode(): string {
    try {
      return randomInt(100000, 999999).toString();
    } catch (error) {
      logger.error('Failed to generate secure OTP code', { error });
      // Fallback to randomBytes if randomInt fails
      const bytes = randomBytes(4);
      const num = bytes.readUInt32BE(0);
      return (100000 + (num % 900000)).toString();
    }
  }

  // Hash OTP code for secure storage with salt and internal pepper to prevent pre-computation
  private hashOTP(code: string, salt: string = 'tecbunny_static_salt'): string {
    const pepper = process.env.OTP_SECRET_PEPPER;
    if (!pepper) {
      throw new Error('CRITICAL: OTP_SECRET_PEPPER is not configured in the environment.');
    }
    return createHash('sha256').update(code + salt + pepper).digest('hex');
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

  // Method Overload for generateOTP
  generateOTP(): Promise<string>;
  generateOTP(request: OTPRequest): Promise<{ success: boolean; otpId?: string; channel?: OTPChannel; message?: string; fallbackAvailable?: boolean; provider?: string; providerMessageId?: string; providerResponse?: any }>;
  async generateOTP(request?: OTPRequest): Promise<any> {
    if (!request) {
      return this.generateOTPCode();
    }

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

      if (hasPhone && request.phone) {
        await assertOtpVelocity(request.phone, request.ipAddress);
      }

      let finalOtpId: string;

      if (supabase) {
        const { data, error } = await supabase
          .from('otp_verifications')
          .insert([{
            code: 'REPLACEME', // Placeholder
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
        finalOtpId = data.id;
        
        // Update with salt derived from real ID
        const realHashedCode = this.hashOTP(code, finalOtpId);
        await supabase.from('otp_verifications').update({ code: realHashedCode }).eq('id', finalOtpId);
      } else {
        finalOtpId = randomUUID();
        const realHashedCode = this.hashOTP(code, finalOtpId);
        await setDistributedOTP(finalOtpId, {
          id: finalOtpId, code: realHashedCode, phone: request.phone, email: request.email, purpose: request.purpose,
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
        otpId: finalOtpId,
        channel: preferredChannel,
        message: `Sent via ${preferredChannel}`,
        fallbackAvailable: false,
        provider: primaryResult.provider,
        providerMessageId: primaryResult.providerMessageId
      };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Method Overload for verifyOTP
  verifyOTP(verification: OTPVerification): Promise<{ success: boolean; message?: string; canRetry?: boolean; suggestFallback?: boolean; nextFallbackChannel?: OTPChannel }>;
  verifyOTP(email: string, otp: string, type?: 'signup' | 'recovery'): Promise<{ success: boolean; message: string }>;
  async verifyOTP(arg1: any, arg2?: string, arg3?: 'signup' | 'recovery'): Promise<any> {
    if (typeof arg1 === 'object' && arg1 !== null) {
      // New verification path (OTPVerification)
      const verification = arg1 as OTPVerification;
      const hashedInput = this.hashOTP(verification.code, verification.otpId); // Use ID as dynamic salt

      try {
        if (!supabase) {
          const otpRecord = await getDistributedOTP(verification.otpId);
          if (!otpRecord) return { success: false, message: 'Invalid OTP ID' };
          if (new Date(otpRecord.expires_at) < new Date()) return { success: false, message: 'OTP has expired' };
          if (otpRecord.verified) return { success: false, message: 'OTP already used' };

          if (otpRecord.attempts >= otpRecord.max_attempts) {
            return { success: false, message: 'Maximum verification attempts exceeded.', canRetry: false };
          }

          if (otpRecord.code !== hashedInput) {
            const newAttempts = otpRecord.attempts + 1;
            otpRecord.attempts = newAttempts;
            await setDistributedOTP(verification.otpId, otpRecord);
            return { success: false, message: `Invalid OTP. ${otpRecord.max_attempts - newAttempts} attempts remaining.`, canRetry: true };
          }

          otpRecord.verified = true;
          otpRecord.verified_at = new Date().toISOString();
          await setDistributedOTP(verification.otpId, otpRecord);
          return { success: true, message: 'OTP verified successfully' };
        }

        const { data: updatedRecord, error: updateError } = await supabase
          .from('otp_verifications')
          .update({ verified: true, verified_at: new Date().toISOString() })
          .eq('id', verification.otpId)
          .eq('code', hashedInput)
          .eq('verified', false)
          .gt('expires_at', new Date().toISOString())
          .lt('attempts', 3)
          .select();

        if (updateError || !updatedRecord || updatedRecord.length === 0) {
          // Atomic update failed. Find out why and increment attempts if applicable.
          const { data: otpRecord } = await supabase
            .from('otp_verifications')
            .select('*')
            .eq('id', verification.otpId)
            .maybeSingle();

          if (!otpRecord) return { success: false, message: 'Invalid OTP ID' };
          if (otpRecord.verified) return { success: false, message: 'OTP already used' };
          if (new Date(otpRecord.expires_at) < new Date()) return { success: false, message: 'OTP has expired' };
          if (otpRecord.attempts >= otpRecord.max_attempts) {
            return { success: false, message: 'Maximum verification attempts exceeded.', canRetry: false };
          }
          
          const newAttempts = otpRecord.attempts + 1;
          await supabase
            .from('otp_verifications')
            .update({ attempts: newAttempts, last_attempt_at: new Date().toISOString() })
            .eq('id', verification.otpId);

          return { 
            success: false, 
            message: `Invalid OTP. ${otpRecord.max_attempts - newAttempts} attempts remaining.`, 
            canRetry: newAttempts < otpRecord.max_attempts 
          };
        }
        return { success: true, message: 'OTP verified successfully' };
      } catch (error) {
        return { success: false, message: 'Verification failed' };
      }
    } else {
      // Legacy verification path
      const email = arg1 as string;
      const otp = arg2 as string;
      const type = arg3 || 'signup';

      const normalizedEmail = email.trim().toLowerCase();
      if (!/^\d{4,6}$/.test(otp || '')) {
        return { success: false, message: 'Invalid or expired OTP' };
      }
      
      const hashedInput = this.hashOTP(otp);
      logger.debug('Starting legacy OTP verification', { email: normalizedEmail, type });

      try {
        let otpRecord: OTPData | null = null;
        let error: { code?: string; message?: string } | null = null;
        if (supabase) {
          logger.debug('Attempting atomic legacy OTP verification', { email: normalizedEmail, type });
          const { data: updatedRecords, error: updateError } = await supabase
            .from('otp_codes')
            .update({ used: true } as any)
            .eq('email', normalizedEmail)
            .eq('type', type)
            .eq('used', false)
            .gte('expires_at', new Date().toISOString())
            .or(`otp.eq.${hashedInput},otp_code.eq.${hashedInput}`)
            .select();

          if (updateError) {
            if (updateError.code === '42P01') {
              logger.warn('OTP table missing; falling back to memory verification', { normalizedEmail, type });
              return this.verifyOTPFromMemory(normalizedEmail, otp, type);
            }
            logger.error('Error verifying legacy OTP atomically', { email: normalizedEmail, type, error: updateError });
            return { success: false, message: 'Failed to verify OTP' };
          }

          if (updatedRecords && updatedRecords.length > 0) {
            return { success: true, message: 'OTP verified successfully' };
          }

          const memoryResult = this.verifyOTPFromMemory(normalizedEmail, otp, type);
          if (memoryResult.success) {
            return memoryResult;
          }
          return { success: false, message: 'Invalid or expired OTP' };
        }
      } catch (error) {
        logger.error('Error verifying legacy OTP', { email, type, error });
        return this.verifyOTPFromMemory(normalizedEmail, otp, type);
      }
    }
  }

  // Legacy functions
  async storeOTP(email: string, otp: string, type: 'signup' | 'recovery' = 'signup'): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const hashedCode = this.hashOTP(otp);
    try {
      if (!supabase) {
        return this.storeOTPInMemory(normalizedEmail, hashedCode, type);
      }
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      const attemptInsert = async () => {
        const insertData: OTPInsertData = {
          email: normalizedEmail,
          otp: hashedCode,
          expires_at: expiresAt.toISOString(),
          type,
          used: false,
        };
        return supabase.from('otp_codes').insert(insertData);
      };

      const { error } = await attemptInsert();

      if (!error) {
        logger.info('OTP stored in database', { strategy: 'primary' });
        return true;
      }

      if (error?.code === '42P01') {
        logger.warn('OTP table not found; using memory storage fallback', { email: type });
        return this.storeOTPInMemory(normalizedEmail, hashedCode, type);
      }

      const columnMissing =
        typeof error?.message === 'string' &&
        (error.message.includes('column') || error.message.includes('otp'));

      if (columnMissing) {
        const legacyData: OTPInsertData = {
          email: normalizedEmail,
          otp_code: hashedCode,
          expires_at: expiresAt.toISOString(),
          type,
          used: false,
        };
        const { error: legacyError } = await supabase
          .from('otp_codes')
          .insert(legacyData);
        if (!legacyError) {
          logger.info('OTP stored in database', { strategy: 'legacy-column' });
          return true;
        }
        logger.error('Error storing OTP using legacy column', { error: legacyError });
        return this.storeOTPInMemory(normalizedEmail, hashedCode, type);
      }

      logger.error('Error storing OTP', { error, normalizedEmail, type });
      return this.storeOTPInMemory(normalizedEmail, hashedCode, type);
    } catch (error) {
      logger.error('Failed to store OTP', { error, normalizedEmail, type });
      return this.storeOTPInMemory(normalizedEmail, hashedCode, type);
    }
  }

  private storeOTPInMemory(email: string, otp: string, type: string): boolean {
    const key = `${email}:${type}`;
    legacyOtpStorage.set(key, {
      otp,
      type,
      expires: Date.now() + 15 * 60 * 1000,
      used: false
    });
    logger.info('OTP stored in memory', { email, type });
    return true;
  }

  private verifyOTPFromMemory(email: string, otp: string, type: string): { success: boolean; message: string } {
    const key = `${email}:${type}`;
    const stored = legacyOtpStorage.get(key);

    if (!stored) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    if (stored.used) {
      return { success: false, message: 'OTP has already been used' };
    }

    if (Date.now() > stored.expires) {
      legacyOtpStorage.delete(key);
      return { success: false, message: 'OTP has expired' };
    }

    if (stored.otp !== otp) {
      return { success: false, message: 'Invalid OTP' };
    }

    stored.used = true;
    logger.info('OTP verified from memory', { email, type });
    return { success: true, message: 'OTP verified successfully' };
  }

  async sendOTP(email: string, type: 'signup' | 'recovery' = 'signup'): Promise<{ success: boolean; message: string; waitTime?: number }> {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const otp = this.generateOTPCode();
      const stored = await this.storeOTP(normalizedEmail, otp, type);
      if (!stored) {
        return { success: false, message: 'Failed to store OTP in database' };
      }
      const emailResult = await improvedEmailService.sendOTPEmail(normalizedEmail, otp, type);
      if (!emailResult.success) {
        return {
          success: false,
          message: emailResult.error || 'Failed to send OTP email',
          waitTime: emailResult.waitTime
        };
      }
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      logger.error('Error in OTP Manager sendOTP', { email, type, error });
      return {
        success: false,
        message: `An error occurred while sending OTP: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async resendOTP(email: string, type: 'signup' | 'recovery' = 'signup'): Promise<{ success: boolean; message: string }> {
    try {
      const twoMinutesAgo = new Date();
      twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);

      if (supabase) {
        const { data: recentOTP, error } = await supabase
          .from('otp_codes')
          .select('created_at')
          .eq('email', email)
          .eq('type', type)
          .gte('created_at', twoMinutesAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (recentOTP && !error) {
          return { success: false, message: 'Please wait 2 minutes before requesting another OTP' };
        }
      }

      return this.sendOTP(email, type);
    } catch (error) {
      logger.error('Error resending OTP', { email, type, error });
      return { success: false, message: 'An error occurred while resending OTP' };
    }
  }

  async cleanupExpiredOTPs(): Promise<void> {
    try {
      if (!supabase) return;
      await supabase
        .from('otp_codes')
        .delete()
        .lt('expires_at', new Date().toISOString());
    } catch (error) {
      logger.error('Failed to cleanup expired OTPs', { error });
    }
  }

  // New OTP methods added to support routing
  async resendOTPWithFallback(otpId: string, fallbackChannel: OTPChannel): Promise<any> {
    try {
      if (!supabase) {
        const otpRecord = await getDistributedOTP(otpId);
        if (!otpRecord) return { success: false, message: 'Invalid OTP ID' };

        const newCode = this.generateOTPCode();
        const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const result = await this.sendOTPViaChannel(fallbackChannel, otpRecord.phone, otpRecord.email, newCode, otpRecord.purpose);
        if (!result.success) return { success: false, message: result.error };

        otpRecord.code = this.hashOTP(newCode, otpId); // Use hashed code for storage
        otpRecord.channel = fallbackChannel;
        otpRecord.attempts = 0;
        otpRecord.expires_at = newExpiresAt.toISOString();
        await setDistributedOTP(otpId, otpRecord);
        return { success: true, message: `OTP resent via ${fallbackChannel}`, channel: fallbackChannel, provider: result.provider, providerMessageId: result.providerMessageId };
      }

      const { data: otpRecord, error } = await supabase.from('otp_verifications').select('*').eq('id', otpId).single();
      if (error || !otpRecord) return { success: false, message: 'Invalid OTP ID' };

      const newCode = this.generateOTPCode();
      const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const result = await this.sendOTPViaChannel(fallbackChannel, otpRecord.phone, otpRecord.email, newCode, otpRecord.purpose);
      if (!result.success) return { success: false, message: result.error };

      const hashedCode = this.hashOTP(newCode, otpId);
      await supabase.from('otp_verifications').update({ code: hashedCode, channel: fallbackChannel, attempts: 0, expires_at: newExpiresAt.toISOString(), created_at: new Date().toISOString() }).eq('id', otpId);
      return { success: true, message: `OTP resent via ${fallbackChannel}`, channel: fallbackChannel, provider: result.provider, providerMessageId: result.providerMessageId };
    } catch (error) {
      return { success: false, message: 'Failed to resend OTP' };
    }
  }

  async getOTPStatus(otpId: string): Promise<any> {
    try {
      if (!supabase) {
        const otpRecord = await getDistributedOTP(otpId);
        if (!otpRecord) return { success: false };
        return { success: true, otpRecord, availableFallbacks: [], canResend: !otpRecord.verified && new Date(otpRecord.expires_at) > new Date() };
      }

      const { data: otpRecord, error } = await supabase.from('otp_verifications').select('*').eq('id', otpId).single();
      if (error || !otpRecord) return { success: false };
      return { success: true, otpRecord, availableFallbacks: [], canResend: !otpRecord.verified && new Date(otpRecord.expires_at) > new Date() };
    } catch (error) {
      return { success: false };
    }
  }
}

export const otpManager = new OTPManager();
export default otpManager;
