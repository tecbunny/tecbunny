'use client';

import { useState, useMemo } from 'react';
import NextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// Force dynamic rendering for auth page
// export const dynamic = 'force-dynamic';
import { Mail, User, Phone, Eye, EyeOff, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';

import Link from 'next/link';

import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

import { useToast } from '../../../hooks/use-toast';
import { logger } from '../../../lib/logger';
import { cn } from '../../../lib/utils';

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '+91',
    password: '',
    confirmPassword: ''
  });
  type PreferredChannel = 'email' | 'whatsapp';
  const [preferredChannel, setPreferredChannel] = useState<PreferredChannel>('whatsapp');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dispatchedChannel, setDispatchedChannel] = useState<'email' | 'sms' | 'whatsapp' | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captchaDisabled = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DISABLE_CAPTCHA === 'true';
  // Allow quick runtime bypass via URL param ?disable_captcha=1 when not in production
  const runtimeBypass = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('disable_captcha') === '1';
  const captchaBypassed = captchaDisabled || (process.env.NODE_ENV !== 'production' && runtimeBypass);
  const Turnstile = useMemo(
    () => NextDynamic(() => import('react-turnstile').then(m => m.default), { ssr: false }) as unknown as React.ComponentType<any>,
    []
  );
  const getVerificationPrompt = (channel?: string) => {
    switch (channel) {
      case 'sms':
        return 'Answer the automated call to hear your verification code.';
      case 'whatsapp':
        return 'Please check your WhatsApp messages for the verification code.';
      default:
        return 'Please check your email inbox for verification instructions.';
    }
  };
  const getChannelLabel = (channel?: string) => {
    switch (channel) {
      case 'sms':
        return 'OTP on Call';
      case 'whatsapp':
        return 'WhatsApp';
      default:
        return 'email';
    }
  };
  
  const router = useRouter();
  const { toast } = useToast();

  if (captchaDisabled) {
    logger.debug('Captcha disabled in client (NEXT_PUBLIC_DISABLE_CAPTCHA=true and NODE_ENV!=production)');
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleChannelChange = (channel: PreferredChannel) => {
    setPreferredChannel(channel);
    setError('');
  };

  const normalizedMobile = formData.mobile.replace(/\D/g, '');
  const mobileSupportsMessaging = normalizedMobile.length >= 10;
  const emailValid = !!formData.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    const normalizedMobile = formData.mobile.replace(/\D/g, '');
    if (!normalizedMobile || normalizedMobile.length < 10) {
      setError('Mobile number is required');
      return false;
    }
    if (!mobileSupportsMessaging) {
      setError('A valid WhatsApp mobile number is required');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    // Enhanced password validation
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
  if (!captchaBypassed && turnstileSiteKey && !captchaToken) {
      setError('Please complete the captcha.');
      return;
    }
    
    setIsLoading(true);
    setError('');

  try {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (captchaBypassed) headers['x-bypass-captcha'] = '1';
  const response = await fetch('/api/auth/signup', {
        method: 'POST',
    headers,
        body: JSON.stringify({
          name: formData.name,
          email: formData.email.trim() || undefined,
          mobile: formData.mobile,
          password: formData.password,
          channel: preferredChannel,
          captchaToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 429 && data.waitTime) {
          setError(`${data.error} Please wait ${Math.ceil(data.waitTime / 60)} minutes before trying again.`);
        } else {
          setError(data.error || 'Signup failed');
        }
        return;
      }

      if (!data?.otpId || typeof data.otpId !== 'string') {
        logger.error('Signup response missing otpId', { data });
        setError('Could not start verification. Please try again.');
        toast({
          variant: 'destructive',
          title: 'Verification unavailable',
          description: 'We could not create a verification reference. Please try signing up again.'
        });
        return;
      }

      // Handle successful signup with potential email issues
      if (data.emailError) {
        // Account created but email failed
        setSuccess(true);
        toast({
          title: 'Account created!',
          description: data.message,
          variant: 'default'
        });
        
        // Show additional info for email issues
        setTimeout(() => {
          toast({
            title: 'Email Issue',
            description: 'You can request a new verification email from the sign-in page.',
            variant: 'default'
          });
        }, 3000);
      } else {
        // Normal successful signup
        setSuccess(true);
        toast({
          title: 'Account created successfully!',
          description: getVerificationPrompt(data.channel),
        });
      }

      const resolvedChannel = (['sms', 'email', 'whatsapp'].includes(data?.channel)
        ? data.channel
        : preferredChannel) as 'email' | 'sms' | 'whatsapp';
      setDispatchedChannel(resolvedChannel);

      // Persist signup session (email, name, mobile, password) for OTP verification and account creation
      try {
        const signupData = {
          email: formData.email.trim() || undefined,
          name: formData.name,
          mobile: formData.mobile,
          password: formData.password,
          otpId: data.otpId,
          channel: resolvedChannel,
          fallbackAvailable: data.fallbackAvailable ?? false,
          timestamp: Date.now(),
        };
        localStorage.setItem('signup_session', JSON.stringify(signupData));
        logger.debug('Signup session persisted', signupData);
      } catch (storageError) {
        logger.warn('Error storing signup session', {
          error: storageError instanceof Error ? storageError.message : String(storageError)
        });
      }

      // Redirect to verification page after 2 seconds
      setTimeout(() => {
        // Redirect to OTP verification page for signup
        const query = new URLSearchParams({
          otpId: data.otpId,
          channel: resolvedChannel,
        });
        if (formData.email.trim()) {
          query.set('email', formData.email.trim());
        }
        if (formData.mobile) {
          query.set('mobile', formData.mobile);
        }
        router.push(`/auth/verify-otp?${query.toString()}`);
      }, 2000);

    } catch (err) {
      logger.error('Signup error', {
        error: err instanceof Error ? err.message : String(err)
      });
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-200 flex items-center justify-center px-4 py-16">
        <style jsx global>{`
          .signup-card {
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 0 40px rgba(139, 92, 246, 0.15);
          }
        `}</style>
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10" />
        <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-purple-400/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />

        <div className="relative w-full max-w-md signup-card rounded-2xl p-8 text-center">
          <div className="mx-auto w-12 h-12 bg-emerald-400/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-emerald-300" />
          </div>
          <h2 className="text-2xl font-bold text-white">Account Created!</h2>
          <p className="mt-2 text-sm text-slate-400">
            {dispatchedChannel
              ? `Verification code sent via ${getChannelLabel(dispatchedChannel)}.`
              : "We're preparing your verification details."}
          </p>
          <p className="mt-4 text-sm text-slate-500">
            {`${getVerificationPrompt(dispatchedChannel ?? undefined)} Redirecting to verification page...`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 flex items-center justify-center px-4 py-16">
      <style jsx global>{`
        .signup-card {
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 40px rgba(139, 92, 246, 0.15);
        }
        .floating-label input:focus ~ label,
        .floating-label input:not(:placeholder-shown) ~ label {
          top: -0.5rem;
          left: 0.75rem;
          font-size: 0.75rem;
          color: #8b5cf6;
          background-color: #0f172a;
          padding: 0 0.25rem;
        }
      `}</style>

      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10" />
      <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-400/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />

      {captchaDisabled && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-2 rounded-md z-50">
          Captcha is disabled in this development environment
        </div>
      )}

      <div className="relative w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900/60 border border-white/10 mb-6 shadow-lg shadow-purple-400/10">
            <User className="h-8 w-8 text-purple-300" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">NEW NODE ENTRY</h1>
          <p className="text-slate-400 text-sm mt-2">Initialize your identity to join the secured network.</p>
        </div>

        <div className="signup-card rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="floating-label relative">
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Name"
                  className="peer w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-400 transition-colors placeholder-transparent"
                  required
                />
                <Label htmlFor="name" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Full Name</Label>
                <User className="absolute right-4 top-3.5 h-4 w-4 text-slate-500" />
              </div>

              <div className="floating-label relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Email"
                  className="peer w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-400 transition-colors placeholder-transparent"
                />
                <Label htmlFor="email" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Email Address (Optional)</Label>
                <Mail className="absolute right-4 top-3.5 h-4 w-4 text-slate-500" />
              </div>

              <div className="floating-label relative">
                <Input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  placeholder="Mobile"
                  className="peer w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-400 transition-colors placeholder-transparent"
                  required
                />
                <Label htmlFor="mobile" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Mobile Number (Required)</Label>
                <Phone className="absolute right-4 top-3.5 h-4 w-4 text-slate-500" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm text-slate-400">Verification Method</Label>
                <div className="grid gap-3">
                  <label className={cn('flex items-center justify-between rounded-lg border p-3 text-sm', preferredChannel === 'email' ? 'border-purple-400/60 bg-purple-400/10' : 'border-white/10 bg-white/5', !emailValid && 'opacity-60')}>
                    <span className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-blue-300" />
                      <span className="flex flex-col">
                        <span className="font-medium text-white">Email</span>
                        <span className="text-xs text-slate-500">Send code via Email</span>
                      </span>
                    </span>
                    <input
                      type="radio"
                      name="verification-channel"
                      value="email"
                      checked={preferredChannel === 'email'}
                      onChange={() => handleChannelChange('email')}
                      className="h-4 w-4 accent-purple-400"
                      disabled={!emailValid}
                    />
                  </label>

                  <label className={cn('flex items-center justify-between rounded-lg border p-3 text-sm', preferredChannel === 'whatsapp' ? 'border-purple-400/60 bg-purple-400/10' : 'border-white/10 bg-white/5', !mobileSupportsMessaging && 'opacity-60')}>
                    <span className="flex items-center gap-3">
                      <MessageCircle className="h-4 w-4 text-emerald-300" />
                      <span className="flex flex-col">
                        <span className="font-medium text-white">WhatsApp</span>
                        <span className="text-xs text-slate-500">Send code via WhatsApp</span>
                      </span>
                    </span>
                    <input
                      type="radio"
                      name="verification-channel"
                      value="whatsapp"
                      checked={preferredChannel === 'whatsapp'}
                      onChange={() => handleChannelChange('whatsapp')}
                      className="h-4 w-4 accent-purple-400"
                      disabled={!mobileSupportsMessaging}
                    />
                  </label>
                </div>
                {(!emailValid || !mobileSupportsMessaging) && (
                  <p className="text-xs text-slate-500 pt-1">
                    {!emailValid && !mobileSupportsMessaging 
                      ? "Provide a valid email or WhatsApp number to enable verification."
                      : !emailValid 
                        ? "Provide a valid email to enable email verification."
                        : "Provide a valid mobile number to enable WhatsApp verification."}
                  </p>
                )}
              </div>

              <div className="floating-label relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Password"
                  className="peer w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-400 transition-colors placeholder-transparent pr-12"
                  required
                />
                <Label htmlFor="password" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Create Password</Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-500 hover:text-purple-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="floating-label relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm"
                  className="peer w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-400 transition-colors placeholder-transparent pr-12"
                  required
                />
                <Label htmlFor="confirmPassword" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Confirm Password</Label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-3.5 text-slate-500 hover:text-purple-300 transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {error && (
                <div className="md:col-span-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-300" />
                  <span className="text-sm text-red-200">{error}</span>
                </div>
              )}

              {turnstileSiteKey && !captchaDisabled && (
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm text-slate-400">Security Check</Label>
                  <div className="mt-1">
                    <Turnstile
                      sitekey={turnstileSiteKey}
                      onVerify={(token: string) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => setCaptchaToken(null)}
                      options={{
                        action: 'signup',
                        theme: 'dark',
                        size: 'normal'
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="md:col-span-2 flex flex-col gap-4">
                <button
                  type="submit"
                  className="group relative w-full py-3 bg-purple-400 hover:bg-white text-slate-900 font-bold tracking-wide rounded-lg transition-colors flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] overflow-hidden"
                  disabled={isLoading}
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                  {isLoading ? 'Creating Account...' : 'Initialize'}
                </button>

                <div className="text-center">
                  <p className="text-sm text-slate-500">
                    Already have an account?{' '}
                    <Link href="/auth/signin" className="font-medium text-cyan-300 hover:text-white">
                      Access Existing Node
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
