import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from './logger';
import { createServiceClient, isSupabaseServiceConfigured } from './supabase/server';

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorVerification {
  success: boolean;
  message: string;
  backupCodeUsed?: boolean;
}

const ENCRYPTED_SECRET_PREFIX = 'enc:v1:';
const HASHED_BACKUP_CODE_PREFIX = 'hash:v1:';

class TwoFactorManager {
  private resolveSupabaseClient(supabase?: SupabaseClient): SupabaseClient {
    if (supabase) {
      return supabase;
    }

    if (isSupabaseServiceConfigured) {
      return createServiceClient();
    }

    throw new Error('Database not configured');
  }

  // Generate a secure TOTP secret and backup codes
  generateSecret(email: string): TwoFactorSetup {
    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `TecBunny Store (${email})`,
      issuer: 'TecBunny Store',
      length: 32
    });

    // Generate backup codes (10 codes, 8 characters each)
    const backupCodes = Array.from({ length: 10 }, () =>
      randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g)?.join('-') || ''
    );

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url || '',
      backupCodes
    };
  }

  // Generate QR code as data URL
  async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      return await qrcode.toDataURL(otpauthUrl);
    } catch (error) {
      logger.error('Error generating QR code:', { error });
      throw new Error('Failed to generate QR code');
    }
  }

  // Verify TOTP token
  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time windows (30 seconds each) for clock skew
    });
  }

  private getEncryptionKey(): Buffer {
    const rawKey = process.env.TOTP_SECRET_ENCRYPTION_KEY;

    if (!rawKey) {
      throw new Error('TOTP secret encryption key is not configured');
    }

    if (/^[a-f0-9]{64}$/i.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }

    if (/^[A-Za-z0-9+/]{43}=$/.test(rawKey) || /^[A-Za-z0-9_-]{43}$/.test(rawKey)) {
      const decoded = Buffer.from(rawKey, 'base64url');
      if (decoded.length === 32) {
        return decoded;
      }
    }

    return createHash('sha256').update(rawKey, 'utf8').digest();
  }

  private encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${ENCRYPTED_SECRET_PREFIX}${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  private decryptSecret(storedSecret: string): string {
    if (!storedSecret.startsWith(ENCRYPTED_SECRET_PREFIX)) {
      return storedSecret;
    }

    const payload = storedSecret.slice(ENCRYPTED_SECRET_PREFIX.length);
    const [ivValue, authTagValue, encryptedValue] = payload.split(':');

    if (!ivValue || !authTagValue || !encryptedValue) {
      throw new Error('Invalid encrypted TOTP secret format');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivValue, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private hashBackupCode(code: string): string {
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const salt = randomBytes(16);
    const hash = scryptSync(normalizedCode, salt, 32);

    return `${HASHED_BACKUP_CODE_PREFIX}${salt.toString('base64url')}:${hash.toString('base64url')}`;
  }

  private verifyBackupCodeHash(storedCode: string, normalizedCode: string): boolean {
    if (!storedCode.startsWith(HASHED_BACKUP_CODE_PREFIX)) {
      return storedCode.replace(/-/g, '').toUpperCase() === normalizedCode;
    }

    const payload = storedCode.slice(HASHED_BACKUP_CODE_PREFIX.length);
    const [saltValue, hashValue] = payload.split(':');
    if (!saltValue || !hashValue) {
      return false;
    }

    const expectedHash = Buffer.from(hashValue, 'base64url');
    const actualHash = scryptSync(normalizedCode, Buffer.from(saltValue, 'base64url'), expectedHash.length);

    return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
  }

  // Verify backup code
  verifyBackupCode(backupCodes: string[], usedCodes: string[], code: string): boolean {
    // Remove hyphens and convert to uppercase for comparison
    const normalizedCode = code.replace(/-/g, '').toUpperCase();

    // Check if code exists and hasn't been used
    return backupCodes.some((backupCode) =>
      this.verifyBackupCodeHash(backupCode, normalizedCode) &&
      !usedCodes.includes(backupCode)
    );
  }

  // Mark backup code as used
  markBackupCodeUsed(backupCodes: string[], usedCodes: string[], code: string): string[] {
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const matchingCode = backupCodes.find(backupCode =>
      this.verifyBackupCodeHash(backupCode, normalizedCode)
    );

    if (matchingCode && !usedCodes.includes(matchingCode)) {
      return [...usedCodes, matchingCode];
    }

    return usedCodes;
  }

  // Enable 2FA for a user
  async enableTwoFactor(
    userId: string,
    secret: string,
    backupCodes: string[],
    supabase?: SupabaseClient
  ): Promise<boolean> {
    const client = this.resolveSupabaseClient(supabase);

    try {
      const encryptedSecret = this.encryptSecret(secret);
      const hashedBackupCodes = backupCodes.map((backupCode) => this.hashBackupCode(backupCode));

      const { error } = await (client as any)
        .from('profiles')
        .update({
          two_factor_enabled: true,
          two_factor_secret: encryptedSecret,
          two_factor_method: 'totp',
          two_factor_backup_codes: hashedBackupCodes,
          two_factor_backup_codes_used: [],
          two_factor_setup_at: new Date().toISOString()
        } as any)
        .eq('id', userId);

      if (error) {
        logger.error('Error enabling 2FA:', { error });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to enable 2FA:', { error });
      return false;
    }
  }

  // Disable 2FA for a user
  async disableTwoFactor(userId: string, supabase?: SupabaseClient): Promise<boolean> {
    const client = this.resolveSupabaseClient(supabase);

    try {
      const { error } = await (client as any)
        .from('profiles')
        .update({
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_method: null,
          two_factor_backup_codes: null,
          two_factor_backup_codes_used: null,
          two_factor_setup_at: null
        } as any)
        .eq('id', userId);

      if (error) {
        logger.error('Error disabling 2FA:', { error });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to disable 2FA:', { error });
      return false;
    }
  }

  // Get 2FA status for a user
  async getTwoFactorStatus(
    userId: string,
    supabase?: SupabaseClient
  ): Promise<{
    enabled: boolean;
    method: string | null;
    setupAt: string | null;
    backupCodesRemaining: number;
  } | null> {
    let client: SupabaseClient;

    try {
      client = this.resolveSupabaseClient(supabase);
    } catch {
      return null;
    }

    try {
      const { data, error } = await (client as any)
        .from('profiles')
        .select('two_factor_enabled, two_factor_method, two_factor_setup_at, two_factor_backup_codes, two_factor_backup_codes_used')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      const backupCodes = Array.isArray(data.two_factor_backup_codes) ? data.two_factor_backup_codes : [];
      const usedCodes = Array.isArray(data.two_factor_backup_codes_used) ? data.two_factor_backup_codes_used : [];
      const backupCodesRemaining = backupCodes.length - usedCodes.length;

      return {
        enabled: Boolean(data.two_factor_enabled),
        method: typeof data.two_factor_method === 'string' ? data.two_factor_method : null,
        setupAt: typeof data.two_factor_setup_at === 'string' ? data.two_factor_setup_at : null,
        backupCodesRemaining
      };
    } catch (error) {
      logger.error('Failed to get 2FA status:', { error });
      return null;
    }
  }

  // Verify 2FA during login
  async verifyTwoFactor(
    userId: string,
    token: string,
    supabase?: SupabaseClient
  ): Promise<TwoFactorVerification> {
    let client: SupabaseClient;

    try {
      client = this.resolveSupabaseClient(supabase);
    } catch (error) {
      logger.error('2FA verification error: supabase client missing', { error });
      return { success: false, message: 'Database not configured' };
    }

    try {
      // Get user's 2FA settings
      const { data: profile, error } = await (client as any)
        .from('profiles')
        .select('two_factor_secret, two_factor_backup_codes, two_factor_backup_codes_used')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        return { success: false, message: 'User not found' };
      }

      if (!profile.two_factor_secret || typeof profile.two_factor_secret !== 'string') {
        return { success: false, message: '2FA not enabled for this account' };
      }

      let secret: string;
      try {
        secret = this.decryptSecret(profile.two_factor_secret);
      } catch (decryptError) {
        logger.error('2FA secret decrypt failed', { error: decryptError, userId });
        return { success: false, message: 'Verification failed' };
      }

      // Try TOTP verification first
      if (this.verifyToken(secret, token)) {
        return { success: true, message: '2FA verification successful' };
      }

      // If TOTP fails, try backup codes
      const backupCodes = Array.isArray(profile.two_factor_backup_codes) ? profile.two_factor_backup_codes : [];
      const usedCodes = Array.isArray(profile.two_factor_backup_codes_used) ? profile.two_factor_backup_codes_used : [];

      if (backupCodes.length > 0 &&
          this.verifyBackupCode(backupCodes, usedCodes, token)) {

        // Mark backup code as used
        const updatedUsedCodes = this.markBackupCodeUsed(backupCodes, usedCodes, token);

        // Update database
        await (client as any)
          .from('profiles')
          .update({ two_factor_backup_codes_used: updatedUsedCodes } as any)
          .eq('id', userId);

        return {
          success: true,
          message: 'Backup code verified successfully',
          backupCodeUsed: true
        };
      }

      return { success: false, message: 'Invalid 2FA code' };
    } catch (error) {
      logger.error('2FA verification error:', { error });
      return { success: false, message: 'Verification failed' };
    }
  }
}

export const twoFactorManager = new TwoFactorManager();
