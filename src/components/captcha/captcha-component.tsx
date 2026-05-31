'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Shield, AlertCircle } from 'lucide-react';

import { logger } from '@/lib/logger';

export interface CaptchaProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact';
  className?: string;
  disabled?: boolean;
}

export interface SimpleCaptchaChallenge {
  id: string;
  question: string;
  answer: string;
  image?: string;
  expires: Date;
}

/**
 * Universal CAPTCHA Component
 * Automatically detects and renders the appropriate CAPTCHA based on configuration
 */
export function CaptchaComponent({ 
  onVerify, 
  onError, 
  onExpire, 
  theme = 'light', 
  size = 'normal', 
  className = '',
  disabled = false 
}: CaptchaProps) {
  const [provider, setProvider] = useState<string>('simple');
  const [siteKey, setSiteKey] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get CAPTCHA configuration from API
    fetch('/api/captcha/config')
      .then(res => res.json())
      .then(config => {
        setProvider(config.provider);
        setSiteKey((config.siteKey || '').trim());
        setLoading(false);
      })
      .catch(error => {
        logger.error('Failed to load CAPTCHA config in captcha-component', { error });
        setProvider('simple');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 bg-white/5 border border-white/10 rounded-lg ${className}`}>
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
        <span className="ml-2 text-sm text-slate-300">Loading security verification...</span>
      </div>
    );
  }

  // Render appropriate CAPTCHA component based on provider
  switch (provider) {
    case 'recaptcha':
      return (
        <ReCaptchaComponent
          siteKey={siteKey}
          onVerify={onVerify}
          onError={onError}
          onExpire={onExpire}
          theme={theme}
          size={size}
          className={className}
          disabled={disabled}
        />
      );
    case 'hcaptcha':
      return (
        <HCaptchaComponent
          siteKey={siteKey}
          onVerify={onVerify}
          onError={onError}
          onExpire={onExpire}
          theme={theme}
          size={size}
          className={className}
          disabled={disabled}
        />
      );
    case 'turnstile':
      return (
        <TurnstileComponent
          siteKey={siteKey}
          onVerify={onVerify}
          onError={(errCode: string) => {
            logger.warn('Turnstile error, falling back to simple captcha', { code: errCode });
            // Fallback to simple captcha if turnstile fails (e.g. invalid site key for domain)
            setProvider('simple');
            if (onError) onError(errCode);
          }}
          onExpire={onExpire}
          theme={theme}
          size={size}
          className={className}
          disabled={disabled}
        />
      );
    case 'simple':
    default:
      return (
        <SimpleCaptchaComponent
          onVerify={onVerify}
          onError={onError}
          onExpire={onExpire}
          theme={theme}
          size={size}
          className={className}
          disabled={disabled}
        />
      );
  }
}

/**
 * Google reCAPTCHA Component
 */
function ReCaptchaComponent({ siteKey, onVerify, onError, onExpire, theme, size, className, disabled }: CaptchaProps & { siteKey: string }) {
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<number | null>(null);

  useEffect(() => {
    if (!siteKey) return;

    const loadRecaptcha = () => {
      if (window.grecaptcha && recaptchaRef.current) {
        const id = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: siteKey,
          theme,
          size,
          callback: onVerify,
          'error-callback': onError,
          'expired-callback': onExpire
        });
        setWidgetId(id);
      }
    };

    if (window.grecaptcha) {
      loadRecaptcha();
    } else {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js';
      script.onload = loadRecaptcha;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetId !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetId);
      }
    };
  }, [siteKey, theme, size, onVerify, onError, onExpire, widgetId]);

  return (
    <div className={`recaptcha-container ${className}`}>
      <div ref={recaptchaRef} className={disabled ? 'opacity-50 pointer-events-none' : ''}></div>
    </div>
  );
}

/**
 * hCaptcha Component
 */
function HCaptchaComponent({ siteKey, onVerify, onError, onExpire, theme, size, className, disabled }: CaptchaProps & { siteKey: string }) {
  const hcaptchaRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;

    const loadHCaptcha = () => {
      if (window.hcaptcha && hcaptchaRef.current) {
        const id = window.hcaptcha.render(hcaptchaRef.current, {
          sitekey: siteKey,
          theme,
          size,
          callback: onVerify,
          'error-callback': onError,
          'expired-callback': onExpire
        });
        setWidgetId(id);
      }
    };

    if (window.hcaptcha) {
      loadHCaptcha();
    } else {
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js';
      script.onload = loadHCaptcha;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetId !== null && window.hcaptcha) {
        window.hcaptcha.reset(widgetId);
      }
    };
  }, [siteKey, theme, size, onVerify, onError, onExpire, widgetId]);

  return (
    <div className={`hcaptcha-container ${className}`}>
      <div ref={hcaptchaRef} className={disabled ? 'opacity-50 pointer-events-none' : ''}></div>
    </div>
  );
}

/**
 * Cloudflare Turnstile Component
 */
function TurnstileComponent({ siteKey, onVerify, onError, onExpire, theme, size, className, disabled }: CaptchaProps & { siteKey: string }) {
  const turnstileRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;

    const loadTurnstile = () => {
      if (window.turnstile && turnstileRef.current) {
        const id = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          theme,
          size,
          callback: onVerify,
          'error-callback': onError,
          'expired-callback': onExpire
        });
        setWidgetId(id);
      }
    };

    if (window.turnstile) {
      loadTurnstile();
    } else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.onload = loadTurnstile;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetId !== null && window.turnstile) {
        window.turnstile.reset(widgetId);
      }
    };
  }, [siteKey, theme, size, onVerify, onError, onExpire, widgetId]);

  return (
    <div className={`turnstile-container ${className}`}>
      <div ref={turnstileRef} className={disabled ? 'opacity-50 pointer-events-none' : ''}></div>
    </div>
  );
}

/**
 * Simple Math/Image CAPTCHA Component
 */
function SimpleCaptchaComponent({ onVerify, onError, onExpire, theme, size, className, disabled }: CaptchaProps) {
  const [challenge, setChallenge] = useState<SimpleCaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const loadChallenge = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/captcha/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'math' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to load CAPTCHA challenge');
      }
      
      const challengeData = await response.json();
      const expiresAt = challengeData.expires ? new Date(challengeData.expires) : new Date(Date.now() + 60000);
      setChallenge({ ...challengeData, expires: expiresAt });
    } catch (error) {
      logger.error('Failed to load simple CAPTCHA challenge', { error });
      const errorMessage = 'Failed to load security challenge';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const verifyAnswer = useCallback(async () => {
    if (!challenge || !answer.trim()) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          response: `${challenge.id}:${answer.trim()}` 
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setVerified(true);
        onVerify(`${challenge.id}:${answer.trim()}`);
      } else {
        const errorMessage = result.error || 'Incorrect answer. Please try again.';
        setError(errorMessage);
        onError?.(errorMessage);
        setAnswer('');
        // Reload challenge after failed attempt
        setTimeout(loadChallenge, 1000);
      }
    } catch (error) {
      logger.error('Simple CAPTCHA verification failed', { error });
      const errorMessage = 'Verification failed. Please try again.';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [challenge, answer, onVerify, onError, loadChallenge]);

  // Auto-verify when answer is entered and Enter is pressed
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && answer.trim()) {
      verifyAnswer();
    }
  };

  // Load challenge on mount
  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  useEffect(() => {
    if (!challenge?.expires || !onExpire) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setVerified(false);
      setAnswer('');
      onExpire();
      loadChallenge();
    }, Math.max(0, challenge.expires.getTime() - Date.now()));

    return () => window.clearTimeout(timeout);
  }, [challenge, onExpire, loadChallenge]);

  const isDarkTheme = theme === 'dark';
  const isCompact = size === 'compact';

  return (
    <div className={`simple-captcha ${className} ${isDarkTheme ? 'dark' : ''}`}>
      <div className={`bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg p-4 ${isCompact ? 'p-3' : 'p-4'} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Shield className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'} text-blue-600 dark:text-blue-400`} />
          <span className={`font-medium text-gray-700 dark:text-gray-300 ${isCompact ? 'text-sm' : 'text-base'}`}>
            Security Verification
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 mb-3">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={loadChallenge}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Try Again
            </button>
          </div>
        ) : verified ? (
          <div className="text-center py-4">
            <div className="text-green-600 dark:text-green-400 text-sm flex items-center justify-center gap-2">
              <Shield className="h-4 w-4" />
              Security verification completed
            </div>
          </div>
        ) : challenge ? (
          <div className="space-y-4">
            {/* Challenge Display */}
            <div className="text-center">
              {challenge.image ? (
                <div className="mb-3">
                  <img 
                    src={challenge.image} 
                    alt="CAPTCHA" 
                    className="mx-auto border rounded"
                  />
                </div>
              ) : null}
              <p className={`text-gray-700 dark:text-gray-300 ${isCompact ? 'text-sm' : 'text-base'}`}>
                {challenge.question}
              </p>
            </div>

            {/* Answer Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Your answer"
                className={`
                  flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${isCompact ? 'text-sm py-1.5' : 'text-base py-2'}
                `}
                disabled={loading}
              />
              <button
                onClick={verifyAnswer}
                disabled={!answer.trim() || loading}
                className={`
                  px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                  text-white rounded-md transition-colors
                  ${isCompact ? 'text-sm py-1.5 px-3' : 'text-base py-2 px-4'}
                `}
              >
                Verify
              </button>
            </div>

            {/* Refresh Button */}
            <div className="text-center">
              <button
                onClick={loadChallenge}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm flex items-center gap-1 mx-auto"
                disabled={loading}
              >
                <RefreshCw className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'}`} />
                New Challenge
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Type declarations for external CAPTCHA libraries
declare global {
  interface Window {
    grecaptcha: any;
    hcaptcha: any;
    turnstile: any;
  }
}