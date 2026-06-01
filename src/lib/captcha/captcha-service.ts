import { logger } from '../logger';

export type CaptchaProvider = 'turnstile';

export interface CaptchaConfig {
  provider: CaptchaProvider;
  siteKey: string;
  secretKey: string;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact' | 'invisible';
  language?: string;
}

export interface CaptchaVerificationResult {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  error?: string;
  errorCodes?: string[];
}

/**
 * Cloudflare Turnstile CAPTCHA service
 */
export class CaptchaService {
  private config: CaptchaConfig;

  constructor(config: CaptchaConfig) {
    this.config = config;
  }

  /**
   * Verify CAPTCHA response from client
   */
  async verifyCaptcha(response: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    try {
      // Handle null, undefined, or empty responses
      if (!response || response.trim() === '') {
        return {
          success: false,
          error: 'No CAPTCHA response provided'
        };
      }

      return await this.verifyTurnstile(response, remoteIp);
    } catch (error: any) {
      logger.error('CAPTCHA verification failed with exception:', { error: error.message || error });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CAPTCHA verification failed'
      };
    }
  }

  /**
   * Get CAPTCHA client configuration for frontend
   */
  getClientConfig(): Omit<CaptchaConfig, 'secretKey'> {
    const { secretKey, ...clientConfig } = this.config;
    return {
      ...clientConfig,
      siteKey: clientConfig.siteKey.trim()
    };
  }

  /**
   * Verify Cloudflare Turnstile
   */
  private async verifyTurnstile(response: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    try {
      const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
      const params = new URLSearchParams({
        secret: this.config.secretKey,
        response,
        ...(remoteIp && remoteIp !== 'unknown' && { remoteip: remoteIp })
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const verifyResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      let data: any;
      try {
        data = await verifyResponse.json();
      } catch (jsonErr) {
        if (!verifyResponse.ok) {
          throw new Error(`Turnstile API returned ${verifyResponse.status}: ${verifyResponse.statusText}`);
        }
        throw new Error('Failed to parse Turnstile API response');
      }

      if (!verifyResponse.ok || !data.success) {
        const errorCodes = data?.['error-codes'] || [];
        logger.warn('Turnstile verification failed:', {
          status: verifyResponse.status,
          success: data?.success ?? false,
          errorCodes,
          hostname: data?.hostname,
          action: data?.action,
          c_ts: data?.challenge_ts
        });

        let errorMsg = errorCodes.join(', ');
        if (errorCodes.includes('invalid-input-secret')) {
          errorMsg = 'invalid-input-secret (The configured secret key is invalid or mismatched)';
        } else if (errorCodes.includes('invalid-input-response')) {
          errorMsg = 'invalid-input-response (The user response token is invalid or expired)';
        } else if (errorCodes.includes('missing-input-secret')) {
          errorMsg = 'missing-input-secret (The secret key parameter is missing)';
        } else if (errorCodes.includes('missing-input-response')) {
          errorMsg = 'missing-input-response (The response token parameter is missing)';
        }

        return {
          success: false,
          error: errorMsg || `Turnstile API returned status ${verifyResponse.status}`,
          errorCodes
        };
      }

      return {
        success: true,
        challenge_ts: data.challenge_ts,
        hostname: data.hostname
      };
    } catch (error: any) {
      logger.error('Turnstile verification failed:', { error: error.message || error });
      return {
        success: false,
        error: error.message || 'Turnstile verification failed'
      };
    }
  }
}

// Create default CAPTCHA service instance loaded strictly from the environment.
const rawSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim();
const rawSecretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();

const siteKey = rawSiteKey;
// Auto-correct if the secret key was set to the default site key (common typo)
const secretKey = rawSecretKey === '0x4AAAAAACXR-JIPYf0PSOt3' ? '0x4AAAAAACXR-AC4lpjtmrjXOPRSlPEE3y4' : rawSecretKey;

const captchaConfig = {
  provider: 'turnstile' as const,
  siteKey,
  secretKey,
  theme: 'light' as const,
  size: 'normal' as const
};

// Log configuration for debugging (without exposing secret key values)
const detected_env_vars = typeof process !== 'undefined' && process.env 
  ? Object.keys(process.env).filter(key => key.includes('TURNSTILE'))
  : [];

logger.info('CAPTCHA Configuration loaded', {
  provider: captchaConfig.provider,
  site_key_prefix: captchaConfig.siteKey ? `${captchaConfig.siteKey.substring(0, 10)}...` : 'NOT SET',
  secret_key_present: captchaConfig.secretKey ? 'SET' : 'NOT SET',
  detected_env_vars,
  theme: captchaConfig.theme,
  size: captchaConfig.size,
  nodeEnv: process.env.NODE_ENV,
  context: 'captcha-service.configuration'
});

// Check for key mismatch
const isSiteKeyDefault = siteKey === '0x4AAAAAACXR-JIPYf0PSOt3';
const isSecretKeyDefault = secretKey === '0x4AAAAAACXR-AC4lpjtmrjXOPRSlPEE3y4';

if (siteKey && secretKey) {
  if (isSiteKeyDefault !== isSecretKeyDefault) {
    logger.error('CAPTCHA configuration mismatch detected! One key is the default development key, but the other is custom. This will cause verification failures.', {
      site_is_dev_default: isSiteKeyDefault,
      secret_is_dev_default: isSecretKeyDefault
    });
  }
}

export const captchaService = new CaptchaService(captchaConfig);

// Export convenience functions
export async function verifyCaptcha(response: string | null, remoteIp?: string): Promise<CaptchaVerificationResult> {
  // If CAPTCHA is not configured, return success: false (Strict mode, don't bypass anything!)
  if (!captchaConfig.siteKey || !captchaConfig.secretKey) {
    return {
      success: false,
      error: 'CAPTCHA is not configured on the server'
    };
  }

  // Delegate to service (handles empty responses)
  return captchaService.verifyCaptcha(response ?? '', remoteIp);
}