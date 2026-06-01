import { logger } from '../logger';

export type CaptchaProvider = 'recaptcha' | 'hcaptcha' | 'turnstile' | 'simple';

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
  score?: number; // For reCAPTCHA v3
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  error?: string;
  errorCodes?: string[];
}

export interface SimpleCaptchaChallenge {
  id: string;
  question: string;
  answer: string;
  image?: string; // Base64 encoded image
  expires: Date;
}

/**
 * Multi-provider CAPTCHA service
 * Supports Google reCAPTCHA, hCaptcha, Cloudflare Turnstile, and simple math CAPTCHA
 */
export class CaptchaService {
  private config: CaptchaConfig;
  private simpleCaptchaStore = new Map<string, SimpleCaptchaChallenge>();

  constructor(config: CaptchaConfig) {
    this.config = config;
    this.startCleanupInterval();
  }

  /**
   * Verify CAPTCHA response from client
   */
  async verifyCaptcha(response: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    try {
      // Development bypass - if CAPTCHA is disabled or in development mode
      if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CAPTCHA === 'true') {
        logger.warn('CAPTCHA verification bypassed in development mode');
        return {
          success: true,
          error: 'Development bypass'
        };
      }

      // Handle null, undefined, or empty responses
      if (!response || response.trim() === '') {
        // In development, don't block on missing CAPTCHA
        if (process.env.NODE_ENV === 'development') {
          logger.warn('No CAPTCHA response provided, allowing in development');
          return {
            success: true,
            error: 'No CAPTCHA response provided (dev bypass)'
          };
        }
        return {
          success: false,
          error: 'No CAPTCHA response provided'
        };
      }

      switch (this.config.provider) {
        case 'recaptcha':
          return await this.verifyRecaptcha(response, remoteIp);
        case 'hcaptcha':
          return await this.verifyHcaptcha(response, remoteIp);
        case 'turnstile':
          return await this.verifyTurnstile(response, remoteIp);
        case 'simple':
          return await this.verifySimpleCaptcha(response);
        default:
          throw new Error(`Unsupported CAPTCHA provider: ${this.config.provider}`);
      }
    } catch (error: any) {
      logger.error('CAPTCHA verification failed:', { error: error.message || error });
      
      // In development mode, allow login even if CAPTCHA fails
      if (process.env.NODE_ENV === 'development') {
        logger.warn('CAPTCHA verification failed, allowing in development mode');
        return {
          success: true,
          error: `CAPTCHA failed but bypassed in development: ${error instanceof Error ? error.message : 'CAPTCHA verification failed'}`
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CAPTCHA verification failed'
      };
    }
  }

  /**
   * Generate simple math CAPTCHA challenge
   */
  generateSimpleCaptcha(): SimpleCaptchaChallenge {
    const id = this.generateId();
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    let answer: number;
    let question: string;

    switch (operation) {
      case '+':
        answer = num1 + num2;
        question = `What is ${num1} + ${num2}?`;
        break;
      case '-':
        answer = Math.max(num1, num2) - Math.min(num1, num2);
        question = `What is ${Math.max(num1, num2)} - ${Math.min(num1, num2)}?`;
        break;
      case '*':
        const smallNum1 = Math.floor(Math.random() * 5) + 1;
        const smallNum2 = Math.floor(Math.random() * 5) + 1;
        answer = smallNum1 * smallNum2;
        question = `What is ${smallNum1} × ${smallNum2}?`;
        break;
      default:
        answer = num1 + num2;
        question = `What is ${num1} + ${num2}?`;
    }

    const challenge: SimpleCaptchaChallenge = {
      id,
      question,
      answer: answer.toString(),
      expires: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    };

    this.simpleCaptchaStore.set(id, challenge);
    return challenge;
  }

  /**
   * Generate image-based CAPTCHA (simple text image)
   */
  generateImageCaptcha(): SimpleCaptchaChallenge {
    const id = this.generateId();
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const challenge: SimpleCaptchaChallenge = {
      id,
      question: 'Enter the code shown in the image',
      answer: code,
      image: this.generateCaptchaImage(code),
      expires: new Date(Date.now() + 5 * 60 * 1000)
    };

    this.simpleCaptchaStore.set(id, challenge);
    return challenge;
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
   * Verify Google reCAPTCHA
   */
  private async verifyRecaptcha(response: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    const url = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: this.config.secretKey,
      response,
      ...(remoteIp && remoteIp !== 'unknown' && { remoteip: remoteIp })
    });

    const verifyResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await verifyResponse.json();

    if (!data.success) {
      logger.warn('Google reCAPTCHA verification failed:', {
        success: data.success,
        errorCodes: data['error-codes'] || [],
        hostname: data.hostname,
        action: data.action,
        c_ts: data.challenge_ts
      });
    }

    return {
      success: data.success,
      score: data.score,
      action: data.action,
      challenge_ts: data.challenge_ts,
      hostname: data.hostname,
      errorCodes: data['error-codes']
    };
  }

  /**
   * Verify hCaptcha
   */
  private async verifyHcaptcha(response: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    const url = 'https://hcaptcha.com/siteverify';
    const params = new URLSearchParams({
      secret: this.config.secretKey,
      response,
      ...(remoteIp && remoteIp !== 'unknown' && { remoteip: remoteIp })
    });

    const verifyResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await verifyResponse.json();

    if (!data.success) {
      logger.warn('hCaptcha verification failed:', {
        success: data.success,
        errorCodes: data['error-codes'] || [],
        hostname: data.hostname,
        c_ts: data.challenge_ts
      });
    }

    return {
      success: data.success,
      challenge_ts: data.challenge_ts,
      hostname: data.hostname,
      errorCodes: data['error-codes']
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

  /**
   * Verify simple CAPTCHA
   */
  private async verifySimpleCaptcha(response: string): Promise<CaptchaVerificationResult> {
    const [challengeId, answer] = response.split(':');
    
    if (!challengeId || !answer) {
      return {
        success: false,
        error: 'Invalid CAPTCHA response format'
      };
    }

    const challenge = this.simpleCaptchaStore.get(challengeId);
    
    if (!challenge) {
      return {
        success: false,
        error: 'CAPTCHA challenge not found or expired'
      };
    }

    if (new Date() > challenge.expires) {
      this.simpleCaptchaStore.delete(challengeId);
      return {
        success: false,
        error: 'CAPTCHA challenge expired'
      };
    }

    const isCorrect = answer.toLowerCase().trim() === challenge.answer.toLowerCase().trim();
    
    // Remove challenge after verification attempt
    this.simpleCaptchaStore.delete(challengeId);

    return {
      success: isCorrect,
      error: isCorrect ? undefined : 'Incorrect CAPTCHA answer'
    };
  }

  /**
   * Generate simple text-based CAPTCHA image (SVG)
   */
  private generateCaptchaImage(text: string): string {
    const width = 150;
    const height = 50;
    const backgroundColor = '#f8f9fa';
    const textColor = '#495057';
    
    // Add some random rotation and positioning
    const rotation = Math.random() * 10 - 5;
    const xOffset = Math.random() * 10 - 5;
    const yOffset = Math.random() * 5 - 2.5;
    
    // Create simple SVG-based CAPTCHA
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="noise" patternUnits="userSpaceOnUse" width="4" height="4">
            <circle cx="2" cy="2" r="0.5" fill="#e9ecef" opacity="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="${backgroundColor}"/>
        <rect width="100%" height="100%" fill="url(#noise)"/>
        <text x="${50 + xOffset}%" y="${50 + yOffset}%" font-family="Arial, sans-serif" font-size="20" 
              font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="${textColor}"
              transform="rotate(${rotation} ${width/2} ${height/2})" letter-spacing="3px">${text}</text>
        <line x1="10" y1="${15 + Math.random() * 10}" x2="${width - 10}" y2="${35 + Math.random() * 10}" 
              stroke="#dee2e6" stroke-width="1" opacity="0.7"/>
        <line x1="${20 + Math.random() * 20}" y1="5" x2="${width - 30 + Math.random() * 20}" y2="${height - 5}" 
              stroke="#dee2e6" stroke-width="1" opacity="0.7"/>
      </svg>
    `;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * Generate unique ID for challenges
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Clean up expired challenges
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      for (const [id, challenge] of this.simpleCaptchaStore.entries()) {
        if (now > challenge.expires) {
          this.simpleCaptchaStore.delete(id);
        }
      }
    }, 60000); // Clean up every minute
  }
}

// Create default CAPTCHA service instance
// HARDCODED FALLBACKS for development mode only.
// In production, missing credentials should result in disabled verification.
const isDev = process.env.NODE_ENV === 'development';
const captchaConfig = {
  provider: (process.env.CAPTCHA_PROVIDER as CaptchaProvider) || 'turnstile',
  siteKey: (process.env.CAPTCHA_SITE_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (isDev ? '0x4AAAAAACXR-JIPYf0PSOt3' : '')).trim(),
  secretKey: (process.env.CAPTCHA_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY || (isDev ? '0x4AAAAAACXR-AC4lpjtmrjXOPRSlPEE3y4' : '')).trim(),
  theme: 'light' as const,
  size: 'normal' as const
};

// Log configuration for debugging (without exposing secret key)
logger.info('CAPTCHA Configuration loaded', {
  provider: captchaConfig.provider,
  siteKey: captchaConfig.siteKey ? `${captchaConfig.siteKey.substring(0, 10)}...` : 'NOT SET',
  secretKey: captchaConfig.secretKey ? 'SET' : 'NOT SET',
  theme: captchaConfig.theme,
  size: captchaConfig.size,
  nodeEnv: process.env.NODE_ENV,
  disableCaptcha: process.env.DISABLE_CAPTCHA,
  context: 'captcha-service.configuration'
});

export const captchaService = new CaptchaService(captchaConfig);

// Export convenience functions
export async function verifyCaptcha(response: string | null, remoteIp?: string): Promise<CaptchaVerificationResult> {
  // If CAPTCHA is not configured, allow verification to pass with a warning
  if (!captchaConfig.siteKey || !captchaConfig.secretKey) {
    return {
      success: true,
      error: 'CAPTCHA not configured'
    };
  }

  // Delegate to service (handles dev bypass and empty responses)
  return captchaService.verifyCaptcha(response ?? '', remoteIp);
}

export function generateSimpleCaptcha(): SimpleCaptchaChallenge {
  return captchaService.generateSimpleCaptcha();
}

export function generateImageCaptcha(): SimpleCaptchaChallenge {
  return captchaService.generateImageCaptcha();
}