'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { toast } from 'react-hot-toast';

import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';

type OTPChannel = 'whatsapp' | 'email';
type ChannelOption = {
  id: OTPChannel;
  label: string;
  helper: string;
  enabled: boolean;
};

export function OTPVerificationContent() {
  const supabase = useMemo(() => createClient(), []);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [otpId, setOtpId] = useState<string | null>(null);
  const [channel, setChannel] = useState<OTPChannel>('whatsapp');
  const [channelOptions, setChannelOptions] = useState<ChannelOption[]>([]);
  const [fallbackAvailable, setFallbackAvailable] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [lastResendTime, setLastResendTime] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const channelDisplayName = useMemo(() => {
    return {
      whatsapp: 'WhatsApp',
      email: 'Email'
    } as const;
  }, []);

  const verificationPrompt = () => {
    if (channel === 'email') {
      return `Enter the code we sent via Email to ${email}`;
    }
    return 'Enter the code we sent via WhatsApp.';
  };

  useEffect(() => {
    const storedDataRaw = typeof window !== 'undefined' ? localStorage.getItem('signup_session') : null;
    let storedData: any = null;
    if (storedDataRaw) {
      try {
        storedData = JSON.parse(storedDataRaw);
      } catch (error) {
        logger.error('Error parsing stored signup data:', { error });
      }
    }

    const urlEmail = searchParams.get('email') || '';
    const urlOtpId = searchParams.get('otpId') || '';
    const urlChannel = searchParams.get('channel') || '';
    const urlMobile = searchParams.get('mobile') || '';

    logger.debug('OTP screen bootstrap', {
      urlEmail,
      urlOtpId,
      urlChannel,
      urlMobile,
      storedData
    });

    const resolvedEmail = urlEmail || storedData?.email || '';
    const resolvedMobile = urlMobile || storedData?.mobile || '';
    const sanitizedMobile = resolvedMobile.replace(/\D/g, '');
    const hasMobile = sanitizedMobile.length >= 10;

    if (!resolvedEmail && !hasMobile) {
      logger.error('No signup session found');
      toast.error('No signup session found. Please start signup process again.');
      router.push('/');
      return;
    }

    setEmail(resolvedEmail);
    setMobile(sanitizedMobile);
    setFallbackAvailable(Boolean(storedData?.fallbackAvailable));

    // Determine preferred channel from URL or stored data, default to whatsapp
    let initialChannel: OTPChannel = 'whatsapp';
    if (urlChannel === 'email' || urlChannel === 'whatsapp') {
      initialChannel = urlChannel;
    } else if (storedData?.channel === 'email' || storedData?.channel === 'whatsapp') {
      initialChannel = storedData.channel;
    } else if (urlEmail && !hasMobile) {
      initialChannel = 'email';
    }

    const candidateOtpId = [urlOtpId, storedData?.otpId]
      .map(value => (typeof value === 'string' ? value.trim() : ''))
      .find(value => value && value.toLowerCase() !== 'undefined' && value.toLowerCase() !== 'null') || null;

    if (!candidateOtpId) {
      logger.warn('No otpId available on OTP screen init', {
        urlOtpId,
        storedOtpId: storedData?.otpId
      });
    }

    setChannel(initialChannel);
    setOtpId(candidateOtpId);

    const options: ChannelOption[] = [
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        helper: hasMobile ? `Send WhatsApp message to +${sanitizedMobile}` : 'Add a mobile number to enable WhatsApp',
        enabled: hasMobile
      },
      {
        id: 'email',
        label: 'Email',
        helper: resolvedEmail ? `Send email to ${resolvedEmail}` : 'Email unavailable',
        enabled: !!resolvedEmail
      }
    ];

    setChannelOptions(options);
  }, [router, searchParams]);

  useEffect(() => {
    const updateCooldown = () => {
      if (lastResendTime > 0) {
        const elapsed = Date.now() - lastResendTime;
        const remaining = Math.max(0, 60000 - elapsed);
        setResendCooldown(Math.ceil(remaining / 1000));
        if (remaining <= 0) {
          setLastResendTime(0);
        }
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [lastResendTime]);

  // Debug button state
  useEffect(() => {
    const buttonDisabled = isLoading || otp.length !== 6 || verified;
    logger.debug('Button state update:', {
      isLoading,
      otpLength: otp.length,
      verified,
      disabled: buttonDisabled,
      otp
    });
  }, [isLoading, otp, verified]);

  const handleChannelSelection = (selectedChannel: OTPChannel) => {
    if (verified) return;
    setChannel(selectedChannel);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    logger.info('Form submitted - Verify OTP triggered!');
    logger.debug('Verify OTP submitted:', {
      otp,
      otpLength: otp.length,
      email,
      isLoading,
      verified
    });
    
    if (!otp || otp.length !== 6) {
      logger.warn('Invalid OTP length');
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    if (!email && !mobile) {
      logger.warn('No contact info found');
      toast.error('Mobile number not found. Please start signup process again.');
      router.push('/');
      return;
    }

    if (!otpId) {
      logger.warn('Missing otpId in verify attempt');
      toast.error('Verification reference expired. Please request a new code.');
      return;
    }

    logger.info('All validations passed, proceeding with OTP verification');
    setIsLoading(true);

    try {
      // Step 1: Verify OTP
    const stored = localStorage.getItem('signup_session');
    let storedMobile: string | undefined = undefined;
    if (stored) {
      try { storedMobile = JSON.parse(stored).mobile; } catch {}
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Always bypass CAPTCHA for OTP verification
    headers['x-bypass-captcha'] = '1';

    const requestBody = {
      email: email || undefined,
      mobile: storedMobile || mobile || undefined,
      otp,
      otpId,
      channel,
      type: 'signup'
    };

    logger.debug('Sending OTP verification request:', {
      url: '/api/auth/verify-otp',
      headers,
      body: requestBody
    });

    const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const verifyResult = await verifyResponse.json();

      logger.debug('Raw API Response:', {
        status: verifyResponse.status,
        statusText: verifyResponse.statusText,
        headers: Object.fromEntries(verifyResponse.headers.entries()),
        result: verifyResult
      });

      if (!verifyResponse.ok) {
        logger.error('OTP verification failed:', {
          status: verifyResponse.status,
          statusText: verifyResponse.statusText,
          result: verifyResult
        });
        
        // Try to extract a meaningful error message
        let errorMessage = 'Verification failed';
        if (verifyResult) {
          if (typeof verifyResult === 'string') {
            errorMessage = verifyResult;
          } else if (verifyResult.error?.message) {
            // API error format: { error: { code, message } }
            errorMessage = verifyResult.error.message;
          } else if (verifyResult.error?.code) {
            errorMessage = `Error: ${verifyResult.error.code}`;
          } else if (verifyResult.error) {
            errorMessage = verifyResult.error;
          } else if (verifyResult.message) {
            errorMessage = verifyResult.message;
          } else if (verifyResult.details) {
            errorMessage = verifyResult.details;
          }
        }
        
        logger.error('Extracted error message:', { errorMessage });
        throw new Error(errorMessage);
      }

      // OTP verified successfully
      logger.info('OTP verified successfully', { verifyResult });
      if (verifyResult?.otpId) {
        setOtpId(verifyResult.otpId);
      }

      // Show verified state in UI and feedback
      setVerified(true);
      toast.success(verifyResult.message || 'Verification successful');

      // For signup type, now create the user account
      if (verifyResult.type === 'signup' || verifyResult.requiresAccountCreation) {
        try {
          // Get stored signup data from localStorage
          const stored = localStorage.getItem('signup_session');
          if (!stored) {
            throw new Error('Signup data not found. Please restart the signup process.');
          }

          const signupData = JSON.parse(stored);
          logger.info('Creating account with stored data:', { email: signupData.email, name: signupData.name });

          // Call complete-signup endpoint to create the account
          const completeResponse = await fetch('/api/auth/complete-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: signupData.email,
              password: signupData.password,
              name: signupData.name,
              mobile: signupData.mobile,
              otpId,
              otpVerified: true
            }),
          });

          const completeResult = await completeResponse.json();

          if (!completeResponse.ok) {
            throw new Error(completeResult.error || 'Failed to create account');
          }

          logger.info('Account created successfully', { completeResult });
          logger.debug('Complete result details:', {
            session: !!completeResult.session,
            requiresSignIn: completeResult.requiresSignIn,
            hasAccessToken: !!(completeResult.session?.access_token),
            hasRefreshToken: !!(completeResult.session?.refresh_token)
          });
          toast.success('Account created successfully!');

          // Clean up stored session data
          localStorage.removeItem('signup_session');
          setOtp('');

          // Check if we got a session for automatic signin
          if (completeResult.session && !completeResult.requiresSignIn) {
            logger.info('Account created and user signed in automatically');
            
            // Set browser session explicitly
            await supabase.auth.setSession({
              access_token: completeResult.session.access_token,
              refresh_token: completeResult.session.refresh_token
            });
            
            toast.success('Welcome! Redirecting to home page...');
            
            // Clean up stored data
            localStorage.removeItem('signup_session');
            
            // Force a full page refresh to ensure auth state is updated
            setTimeout(() => {
              logger.info('Redirecting to home page with page refresh');
              window.location.href = '/';
            }, 1500);
          } else {
            // Account created successfully - redirect to sign in
            logger.info('Account created, redirecting to sign-in page');
            toast.success('Account created! Please sign in to continue.');
            setTimeout(() => {
              router.push(`/auth/signin?email=${encodeURIComponent(email)}&verified=true&accountCreated=true`);
            }, 1500);
          }
        } catch (accountCreationError) {
          logger.error('Account creation error:', { accountCreationError });
          toast.error(accountCreationError instanceof Error ? accountCreationError.message : 'Failed to create account');
          setVerified(false);
          setIsLoading(false);
          return;
        }
      } else {
        // For non-signup verifications, just redirect to success page
        setTimeout(() => {
          router.push(`/auth/verification-success?email=${encodeURIComponent(email)}`);
        }, 1200);
      }
      
    } catch (error) {
      logger.error('OTP verification error:', { error });
      if (error instanceof Error) {
        logger.error('Error message:', { message: error.message, stack: error.stack });
      } else {
        logger.error('Error details:', { error: JSON.stringify(error, null, 2) });
      }
      toast.error(error instanceof Error ? error.message : 'Verification failed');
      setVerified(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    logger.debug('Resend requested', { email, otpId, channel, resendCount, resendCooldown });

    if (channel === 'whatsapp' && !mobile) {
      toast.error('Mobile number not found. Please restart the signup process.');
      return;
    }

    if (channel === 'email' && !email) {
      toast.error('Email address not found. Please restart the signup process.');
      return;
    }

    if (!otpId) {
      toast.error('Verification reference missing. Please restart signup.');
      return;
    }

    const selectedChannel = channelOptions.find(option => option.id === channel);
    if (!selectedChannel || !selectedChannel.enabled) {
      toast.error(`${channelDisplayName[channel]} verification is unavailable. Please try again later.`);
      return;
    }

    // Check cooldown
    if (resendCooldown > 0) {
      toast.error(`Please wait ${resendCooldown} seconds before requesting another code.`);
      return;
    }

    setIsResending(true);

  try {
  logger.debug('Resend request payload', { otpId, channel });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    headers['x-bypass-captcha'] = '1';

    const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          otpId,
      channel,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setResendCount(prev => prev + 1);
        setLastResendTime(Date.now());
        setOtp(''); // Clear current OTP input

        const resolvedChannel = (result?.channel as OTPChannel) || channel;

        if (resolvedChannel !== channel) {
          setChannel(resolvedChannel);
        }

        if (result?.otpId) {
          setOtpId(result.otpId);
        }

        toast.success(
          result?.message
            ? `${result.message}`
            : `New verification code sent via ${channelDisplayName[resolvedChannel]}.`
        );

        if (Array.isArray(result?.availableFallbacks)) {
          setFallbackAvailable(result.availableFallbacks.length > 0);
          setChannelOptions(current => current.map(option => ({
            ...option,
            enabled: option.enabled || result.availableFallbacks.includes(option.id)
          })));
        }
      } else {
        throw new Error(result.error || 'Failed to resend verification code');
      }
    } catch (error) {
      logger.error('Resend OTP error:', { error });
      toast.error(error instanceof Error ? error.message : 'Failed to resend verification code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 text-foreground">
      <div className="max-w-md w-full space-y-8">
        {verified && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-4 py-3 rounded-md flex items-center space-x-3">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-medium">Verification complete</div>
              <div className="text-sm">Redirecting you to the next step...</div>
            </div>
          </div>
        )}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tech-heading">
            Verify Your Account
          </h2>
          <p className="mt-2 text-center text-sm tech-body">
            {verificationPrompt()}
            {mobile && channel === 'whatsapp' && (
              <span className="font-medium text-foreground block">+{mobile}</span>
            )}
          </p>
          {fallbackAvailable && (
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Having trouble? Request a new WhatsApp code below.
            </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleVerifyOTP}>
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Verification method</span>
            <div className="grid gap-2">
              {channelOptions.map(option => (
                <div
                  key={option.id}
                  onClick={() => !option.enabled ? undefined : handleChannelSelection(option.id)}
                  className={`flex w-full flex-col rounded-lg border p-3 text-left transition-all ${
                    option.enabled ? 'cursor-pointer hover:bg-muted/80' : 'cursor-not-allowed'
                  } ${
                    channel === option.id ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-muted text-foreground'
                  } ${!option.enabled ? 'opacity-60' : ''}`}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.helper}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-foreground mb-2">
              Verification Code
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              className="appearance-none relative block w-full px-3 py-2 border border-border bg-muted placeholder:text-muted-foreground text-foreground rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm text-center text-lg tracking-widest"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading || otp.length !== 6 || verified}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </>
              ) : (
                'Verify & Complete Signup'
              )}
            </button>
          </div>
          
          <div className="text-center">
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={isResending || resendCooldown > 0 || verified}
              className={`text-sm transition-colors cursor-pointer ${
                isResending || resendCooldown > 0
                  ? 'text-muted-foreground cursor-not-allowed' 
                  : 'text-primary hover:underline'
              }`}
            >
              {isResending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                `Wait ${resendCooldown}s to resend`
              ) : (
                `Resend via ${channelDisplayName[channel]} (${resendCount}/3)`
              )}
            </button>
            {resendCount > 0 && resendCooldown === 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {resendCount}/3 resend attempts used
              </div>
            )}
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
            >
              ← Back to Home
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
