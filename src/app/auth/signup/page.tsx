'use client';

import { useState, useMemo } from 'react';
import NextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// Force dynamic rendering for auth page
// export const dynamic = 'force-dynamic';
import { Mail, User, Phone, Eye, EyeOff, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';

import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useToast } from '../../../hooks/use-toast';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

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
  const [dispatchedChannel, setDispatchedChannel] = useState<'email' | 'whatsapp' | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const Turnstile = useMemo(
    () => NextDynamic(() => import('react-turnstile').then(m => m.default), { ssr: false }) as unknown as React.ComponentType<any>,
    []
  );
  const getVerificationPrompt = (channel?: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'Please check your WhatsApp messages for the verification code.';
      default:
        return 'Please check your email inbox for verification instructions.';
    }
  };
  const getChannelLabel = (channel?: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'WhatsApp';
      default:
        return 'email';
    }
  };
  
  const router = useRouter();
  const { toast } = useToast();

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
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, one special character (@$!%*?&), and only use letters, numbers, and allowed special characters.');
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
    if (turnstileSiteKey && !captchaToken) {
      setError('Please complete the captcha.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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

      const resolvedChannel = (['email', 'whatsapp'].includes(data?.channel)
        ? data.channel
        : preferredChannel) as 'email' | 'whatsapp';
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-16">
        <div className="absolute inset-0 bg-noise opacity-10" />
        <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-primary/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />

        <div className="relative w-full max-w-md signup-card rounded-2xl p-8 text-center border border-border bg-card">
          <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold tech-heading">Account Created!</h2>
          <p className="mt-2 text-sm tech-body">
            {dispatchedChannel
              ? `Verification code sent via ${getChannelLabel(dispatchedChannel)}.`
              : "We're preparing your verification details."}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {`${getVerificationPrompt(dispatchedChannel ?? undefined)} Redirecting to verification page...`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-16">
      <div className="absolute inset-0 bg-noise opacity-10" />
      <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />

      <div className="relative w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted border border-border mb-6 shadow-lg shadow-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tech-heading tracking-wide">NEW NODE ENTRY</h1>
          <p className="tech-body text-sm mt-2">Initialize your identity to join the secured network.</p>
        </div>

        <div className="signup-card rounded-2xl p-8 border border-border bg-card">
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
                  className="peer w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-primary transition-colors placeholder-transparent"
                  required
                />
                <Label htmlFor="name" className="absolute left-4 top-3 text-muted-foreground text-sm transition-all pointer-events-none">Full Name</Label>
                <User className="absolute right-4 top-3.5 h-4 w-4 text-muted-foreground" />
              </div>

              <div className="floating-label relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Email"
                  className="peer w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-primary transition-colors placeholder-transparent"
                />
                <Label htmlFor="email" className="absolute left-4 top-3 text-muted-foreground text-sm transition-all pointer-events-none">Email Address (Optional)</Label>
                <Mail className="absolute right-4 top-3.5 h-4 w-4 text-muted-foreground" />
              </div>

              <div className="floating-label relative">
                <Input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  placeholder="Mobile"
                  className="peer w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-primary transition-colors placeholder-transparent"
                  required
                />
                <Label htmlFor="mobile" className="absolute left-4 top-3 text-muted-foreground text-sm transition-all pointer-events-none">Mobile Number (Required)</Label>
                <Phone className="absolute right-4 top-3.5 h-4 w-4 text-muted-foreground" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm text-muted-foreground">Verification Method</Label>
                <div className="grid gap-3">
                  <label className={cn('flex items-center justify-between rounded-lg border p-3 text-sm cursor-pointer', preferredChannel === 'email' ? 'border-primary/60 bg-primary/10' : 'border-border bg-muted', !emailValid && 'opacity-60')}>
                    <span className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="flex flex-col">
                        <span className="font-medium text-foreground">Email</span>
                        <span className="text-xs text-muted-foreground">Send code via Email</span>
                      </span>
                    </span>
                    <input
                      type="radio"
                      name="verification-channel"
                      value="email"
                      checked={preferredChannel === 'email'}
                      onChange={() => handleChannelChange('email')}
                      className="h-4 w-4 accent-primary"
                      disabled={!emailValid}
                      aria-label="Verify via email"
                    />
                  </label>

                  <label className={cn('flex items-center justify-between rounded-lg border p-3 text-sm cursor-pointer', preferredChannel === 'whatsapp' ? 'border-primary/60 bg-primary/10' : 'border-border bg-muted', !mobileSupportsMessaging && 'opacity-60')}>
                    <span className="flex items-center gap-3">
                      <MessageCircle className="h-4 w-4 text-primary" />
                      <span className="flex flex-col">
                        <span className="font-medium text-foreground">WhatsApp</span>
                        <span className="text-xs text-muted-foreground">Send code via WhatsApp</span>
                      </span>
                    </span>
                    <input
                      type="radio"
                      name="verification-channel"
                      value="whatsapp"
                      checked={preferredChannel === 'whatsapp'}
                      onChange={() => handleChannelChange('whatsapp')}
                      className="h-4 w-4 accent-primary"
                      disabled={!mobileSupportsMessaging}
                      aria-label="Verify via WhatsApp"
                    />
                  </label>
                </div>
                {(!emailValid || !mobileSupportsMessaging) && (
                  <p className="text-xs text-muted-foreground pt-1">
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
                  className="peer w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-primary transition-colors placeholder-transparent pr-12"
                  required
                />
                <Label htmlFor="password" className="absolute left-4 top-3 text-muted-foreground text-sm transition-all pointer-events-none">Create Password</Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
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
                  className="peer w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-primary transition-colors placeholder-transparent pr-12"
                  required
                />
                <Label htmlFor="confirmPassword" className="absolute left-4 top-3 text-muted-foreground text-sm transition-all pointer-events-none">Confirm Password</Label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {error && (
                <div className="md:col-span-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-200">{error}</span>
                </div>
              )}

              {turnstileSiteKey && (
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm text-muted-foreground">Security Check</Label>
                  <div className="mt-1">
                    <Turnstile
                      sitekey={turnstileSiteKey}
                      action="signup"
                      theme="dark"
                      size="normal"
                      retry="auto"
                      refreshExpired="auto"
                      appearance="always"
                      onVerify={(token: string) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={(captchaError: unknown) => {
                        setCaptchaToken(null);
                        logger.error('signup.turnstile_render_failed', { error: captchaError });
                        setError('Security check failed to load. Please refresh the page or disable browser tracking protection for this site.');
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="md:col-span-2 flex flex-col gap-4">
                <button
                  type="submit"
                  className="group relative w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide rounded-lg transition-colors flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] overflow-hidden cursor-pointer"
                  disabled={isLoading}
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                  {isLoading ? 'Creating Account...' : 'Initialize'}
                </button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href="/auth/signin" className="font-medium text-primary hover:underline">
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
