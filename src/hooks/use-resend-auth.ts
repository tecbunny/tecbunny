'use client';

import { useState, useCallback, useEffect } from 'react';

import { logger } from '@/lib/logger';

interface UseResendAuthReturn {
  sendOTP: (email: string, type?: 'signup' | 'recovery', captchaToken?: string | null) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (email: string, otp: string, type?: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  cooldownSeconds: number;
  canSendOTP: boolean;
  error: string | null;
  clearError: () => void;
}

export function useResendAuth(): UseResendAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Handle countdown timer
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    // No cleanup needed when cooldown is 0
    return undefined;
  }, [cooldownSeconds]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sendOTP = useCallback(async (email: string, type: 'signup' | 'recovery' = 'signup', captchaToken?: string | null) => {
    setIsLoading(true);
    setError(null);

    try {
      // include mobile from local signup session when available (supports SMS flows)
      const stored = localStorage.getItem('signup_session');
      let storedMobile: string | undefined = undefined;
      if (stored) {
        try { storedMobile = JSON.parse(stored).mobile; } catch {}
      }

      // Use our custom OTP API endpoint
      logger.debug('sendOTP using identifier', { identifier: storedMobile || email, type });
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
  body: JSON.stringify({ email, mobile: storedMobile, type, captchaToken }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCooldownSeconds(60); // Default 60 second cooldown for successful sends
        setIsLoading(false);
        return { success: true };
      } else {
        // Handle rate limiting errors with dynamic wait times
        const errorMessage = data.error || 'Failed to send OTP';
        
        // Extract wait time from error message if available
        if (errorMessage.includes('wait') && errorMessage.includes('seconds')) {
          const waitMatch = errorMessage.match(/wait (\d+) seconds/);
          if (waitMatch) {
            const waitSeconds = parseInt(waitMatch[1], 10);
            setCooldownSeconds(waitSeconds);
          }
        } else if (errorMessage.includes('wait') && errorMessage.includes('minutes')) {
          const waitMatch = errorMessage.match(/wait (\d+) more minutes/);
          if (waitMatch) {
            const waitMinutes = parseInt(waitMatch[1], 10);
            setCooldownSeconds(waitMinutes * 60);
          }
        } else {
          // Default cooldown for other errors
          setCooldownSeconds(60);
        }
        
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send verification email';
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  const verifyOTP = useCallback(async (email: string, otp: string, type: string = 'signup') => {
    setIsLoading(true);
    setError(null);

    try {
      // include mobile from local signup session when available (supports SMS flows)
      const stored = localStorage.getItem('signup_session');
      let storedMobile: string | undefined = undefined;
      if (stored) {
        try { storedMobile = JSON.parse(stored).mobile; } catch {}
      }

      // Use our custom OTP verification API endpoint
      logger.debug('verifyOTP using identifier', { identifier: storedMobile || email, type });
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          mobile: storedMobile,
          otp,
          type,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsLoading(false);
        
        // Log success details for debugging
        logger.info('OTP verification successful:', {
          action: data.action,
          message: data.message,
          user: data.user
        });
        
        return { 
          success: true, 
          action: data.action,
          message: data.message,
          user: data.user
        };
      } else {
        throw new Error(data.error || 'Failed to verify OTP');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to verify OTP';
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  return {
    sendOTP,
    verifyOTP,
    isLoading,
    cooldownSeconds,
    canSendOTP: cooldownSeconds === 0 && !isLoading,
    error,
    clearError,
  };
}