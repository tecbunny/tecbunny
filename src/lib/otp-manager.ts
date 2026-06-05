import { randomBytes } from 'crypto';

import { createClient } from '@supabase/supabase-js';

import improvedEmailService from './improved-email-service';
import { logger } from './logger';

export interface OTPData {
  id: string;
  email: string;
  otp: string; // Changed from otp_code to otp
  expires_at: string;
  type: 'signup' | 'recovery';
  used: boolean;
  created_at: string;
}

interface OTPInsertData {
  email: string;
  otp?: string;
  otp_code?: string; 
  expires_at: string;
  type: 'signup' | 'recovery';
  used: boolean;
}

class OTPManager {
  private supabase: ReturnType<typeof createClient> | null;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Use service role key from either SUPABASE_SERVICE_ROLE_KEY or override from NEXT_PUBLIC
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      this.supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } else {
      this.supabase = null;
      logger.warn('Supabase environment variables missing; using in-memory OTP storage fallback');
    }
  }

  // Generate a secure 4-digit OTP using crypto
  generateOTP(): string {
    // Use crypto for secure random number generation
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      // Browser environment
      try {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        const value = array[0];
        if (value !== undefined) {
          return (1000 + (value % 9000)).toString();
        }
      } catch (error) {
        logger.warn('Browser crypto entropy failed; falling back to Node.js crypto', { error });
      }
    }
    
    if (typeof randomBytes !== 'undefined') {
      // Node.js environment
      try {
        const bytes = randomBytes(4);
        const num = bytes.readUInt32BE(0);
        return (1000 + (num % 9000)).toString();
      } catch (error) {
        logger.warn('Node crypto failed; falling back to Math.random', { error });
        return Math.floor(1000 + Math.random() * 9000).toString();
      }
    } else {
      // Fallback for environments without crypto
      return Math.floor(1000 + Math.random() * 9000).toString();
    }
  }

  // Store OTP in database with fallback to memory
    async storeOTP(email: string, otp: string, type: 'signup' | 'recovery' = 'signup'): Promise<boolean> {
    // Normalize identifier to lower-case to match stored records
    const normalizedEmail = email.trim().toLowerCase();

    try {
      // If Supabase isn't available, fallback to in-memory storage
      if (!this.supabase) {
        return this.storeOTPInMemory(normalizedEmail, otp, type);
      }
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes from now

      // First, try inserting into the new column name 'otp'
      const attemptInsert = async () => {
        const insertData: OTPInsertData = {
          email: normalizedEmail,
          otp, // preferred column name
          expires_at: expiresAt.toISOString(),
          type,
          used: false,
        };
        return (this.supabase as any).from('otp_codes').insert(insertData);
      };

      const { error } = await attemptInsert();

      if (!error) {
        logger.info('OTP stored in database', { strategy: 'primary' });
        return true;
      }

      // If table missing -> fallback to memory
      if (error?.code === '42P01') {
        logger.warn('OTP table not found; using memory storage fallback', { email, type });
        return this.storeOTPInMemory(normalizedEmail, otp, type);
      }

      // If column "otp" doesn't exist, retry with legacy column name 'otp_code'
      const columnMissing =
        typeof error?.message === 'string' &&
        (error.message.includes('column') || error.message.includes('column') || error.message.includes('otp'));

      if (columnMissing) {
        const legacyData: OTPInsertData = {
          email: normalizedEmail,
          otp_code: otp, // legacy column
          expires_at: expiresAt.toISOString(),
          type,
          used: false,
        };
        const { error: legacyError } = await (this.supabase as any)
          .from('otp_codes')
          .insert(legacyData);
        if (!legacyError) {
          logger.info('OTP stored in database', { strategy: 'legacy-column' });
          return true;
        }
        logger.error('Error storing OTP using legacy column', { error: legacyError });
        return this.storeOTPInMemory(normalizedEmail, otp, type);
      }

      // Any other DB error -> fallback to memory
      logger.error('Error storing OTP', { error, normalizedEmail, type });
      return this.storeOTPInMemory(normalizedEmail, otp, type);
    } catch (error) {
      logger.error('Failed to store OTP', { error, normalizedEmail, type });
      return this.storeOTPInMemory(normalizedEmail, otp, type);
    }
  }

  // In-memory OTP storage as fallback
  private otpStorage = new Map<string, {otp: string, type: string, expires: number, used: boolean}>();

  private storeOTPInMemory(email: string, otp: string, type: string): boolean {
    const key = `${email}:${type}`;
    this.otpStorage.set(key, {
      otp,
      type,
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      used: false
    });
  logger.info('OTP stored in memory', { email, type });
    return true;
  }

  // Send OTP email
  async sendOTP(email: string, type: 'signup' | 'recovery' = 'signup'): Promise<{ success: boolean; message: string; waitTime?: number }> {
    // Normalize identifier to lower-case to match stored records
    const normalizedEmail = email.trim().toLowerCase();

    try {
      
      // Generate OTP
      const otp = this.generateOTP();

      const stored = await this.storeOTP(normalizedEmail, otp, type);
      if (!stored) {
        return { success: false, message: 'Failed to store OTP in database' };
      }
  // Send email
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

  // Verify OTP with database and memory fallback
  async verifyOTP(email: string, otp: string, type: 'signup' | 'recovery' = 'signup'): Promise<{ success: boolean; message: string }> {
    // Normalize identifier to lower-case
    const normalizedEmail = email.trim().toLowerCase();
    logger.debug('Starting OTP verification', { email, type });
    try {


      // Try database first if configured
      let otpRecord: OTPData | null = null;
      let error: { code?: string; message?: string } | null = null;
      if (this.supabase) {
        logger.debug('Checking database for OTP record', { email: normalizedEmail, type });
        // Support both new ('otp') and legacy ('otp_code') column names
        const builder = (this.supabase as any)
          .from('otp_codes')
          .select('*')
          .eq('email', normalizedEmail)
          .eq('type', type)
          .eq('used', false)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        // Use OR filter to match either column value
        // supabase-js: .or('otp.eq.123,otp_code.eq.123')
        const resp = await builder
          .or(`otp.eq.${otp},otp_code.eq.${otp}`)
          .single();
        otpRecord = resp.data;
        error = resp.error;

        // Debug: log the fetched OTP record
        logger.debug('Database OTP record fetched', { email, type, otpRecord, error });

        logger.debug('Database OTP query result', { email, type, hasRecord: !!otpRecord, error });
      } else {
        logger.warn('No Supabase connection available for OTP verification', { email, type });
      }

      if (error && error.code === '42P01') {
        // Table doesn't exist, check memory storage
        logger.warn('OTP table missing; falling back to memory verification', { normalizedEmail, type });
        return this.verifyOTPFromMemory(normalizedEmail, otp, type);
      } else if (error || !otpRecord) {
        // Check memory storage as fallback
        logger.debug('Database OTP not found; falling back to memory', { email, type, error });
        const memoryResult = this.verifyOTPFromMemory(email, otp, type);
        if (memoryResult.success) {
          return memoryResult;
        }
        logger.debug('Memory OTP verification failed', { email, type });
        return { success: false, message: 'Invalid or expired OTP' };
      }

      // Mark OTP as used in database
      if (!this.supabase) {
        // Shouldn't happen because otpRecord exists only when supabase was queried
        return { success: false, message: 'Failed to verify OTP' };
      }
      const { error: updateError } = await (this.supabase as any)
        .from('otp_codes')
        .update({ used: true } as any)
        .eq('id', otpRecord.id);

      if (updateError) {
        logger.error('Error marking OTP as used', { normalizedEmail, type, otpId: otpRecord.id, error: updateError });
        return { success: false, message: 'Failed to verify OTP' };
      }

      return { success: true, message: 'OTP verified successfully' };
    } catch (error) {
      logger.error('Error verifying OTP', { email, type, error });
      // Try memory storage as final fallback
      return this.verifyOTPFromMemory(email, otp, type);
    }
  }

  private verifyOTPFromMemory(email: string, otp: string, type: string): { success: boolean; message: string } {
    const key = `${email}:${type}`;
    logger.debug('Checking memory storage for OTP', {
      key,
      storedKeys: this.otpStorage.size,
    });
    
    const stored = this.otpStorage.get(key);
    
    if (!stored) {
      logger.debug('No OTP found in memory for key', { key });
      return { success: false, message: 'Invalid or expired OTP' };
    }
    
    if (stored.used) {
      logger.warn('OTP already used in memory', { key });
      return { success: false, message: 'OTP has already been used' };
    }
    
    if (Date.now() > stored.expires) {
      logger.warn('OTP expired in memory', { key });
      this.otpStorage.delete(key);
      return { success: false, message: 'OTP has expired' };
    }
    
    if (stored.otp !== otp) {
      logger.warn('OTP mismatch in memory', { key });
      return { success: false, message: 'Invalid OTP' };
    }
    
    // Mark as used
    stored.used = true;
    logger.info('OTP verified from memory', { email, type });
    
    return { success: true, message: 'OTP verified successfully' };
  }

  // Clean up expired OTPs (optional, can be run periodically)
  async cleanupExpiredOTPs(): Promise<void> {
    try {
      if (!this.supabase) return;
      const { error } = await this.supabase
        .from('otp_codes')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        logger.error('Error cleaning up expired OTPs', { error });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired OTPs', { error });
    }
  }

  // Resend OTP (with rate limiting)
  async resendOTP(email: string, type: 'signup' | 'recovery' = 'signup'): Promise<{ success: boolean; message: string }> {
    try {
      // Check if there's a recent OTP (within last 2 minutes)
      const twoMinutesAgo = new Date();
      twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);

      if (this.supabase) {
        const { data: recentOTP, error } = await this.supabase
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

      // Send new OTP
      return this.sendOTP(email, type);
    } catch (error) {
      logger.error('Error resending OTP', { email, type, error });
      return { success: false, message: 'An error occurred while resending OTP' };
    }
  }

  // Phone OTP delivery is handled by MultiChannelOTPManager through Infobip WhatsApp.
}

export const otpManager = new OTPManager();
export default otpManager;
