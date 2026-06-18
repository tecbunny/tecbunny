'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import NextDynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Phone } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { normalizeRole } from '@/lib/roles';

// Force dynamic rendering for auth page
// export const dynamic = 'force-dynamic';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useToast } from '../../../hooks/use-toast';
import { TwoFactorVerification } from '@/components/auth/TwoFactorVerification';

function SignInForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorUser, setTwoFactorUser] = useState<any>(null);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const Turnstile = useMemo(
    () => NextDynamic(() => import('react-turnstile').then(m => m.default), { ssr: false }) as unknown as React.ComponentType<any>,
    []
  );

  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const verified = searchParams.get('verified');
  const emailParam = searchParams.get('email');

  // Check if account is locked out
  const isLockedOut = useMemo(() => {
    if (!lockoutUntil) return false;
    return Date.now() < lockoutUntil;
  }, [lockoutUntil]);

  // Calculate remaining lockout time
  const lockoutTimeRemaining = useMemo(() => {
    if (!isLockedOut || !lockoutUntil) return 0;
    return Math.ceil((lockoutUntil - Date.now()) / 1000);
  }, [isLockedOut, lockoutUntil]);

  useEffect(() => {
    if (verified === 'true') {
      toast({
        title: 'Email verified successfully!',
        description: 'Your account has been created. You can now sign in.',
      });
      if (emailParam) {
        setIdentifier(decodeURIComponent(emailParam));
      }
    }
  }, [verified, emailParam, toast]);

  const handleTwoFactorVerify = async (code: string) => {
    if (!twoFactorUser) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Invalid 2FA code');
        return;
      }

      toast({
        title: 'Welcome back!',
        description: 'You have been signed in successfully.',
      });

      // Fetch user profile to determine role-based redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', twoFactorUser.id)
        .single();

      // Redirect based on user role
      const userRole = normalizeRole(profile?.role) ?? 'customer';
      let redirectUrl: string;

      switch (userRole) {
        case 'admin':
          redirectUrl = '/mgmt/admin';
          break;
        case 'manager':
          redirectUrl = '/mgmt/manager';
          break;
        case 'sales':
        case 'service_engineer':
          redirectUrl = '/mgmt/sales';
          break;
        case 'accounts':
          redirectUrl = '/mgmt/accounts';
          break;
        case 'customer':
        default:
          redirectUrl = '/';
          break;
      }

      window.location.href = redirectUrl;
    } catch (err) {
      console.error('2FA verification error:', err);
      setError('An unexpected error occurred during 2FA verification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorCancel = () => {
    setShowTwoFactor(false);
    setTwoFactorUser(null);
    setError('');
  };

  // ─── Shared post sign-in handler ───────────────────────────────────────────
  // Called after a successful Supabase signInWithPassword regardless of identifier type.
  const handleSignInSuccess = async (user: any) => {
    setFailedAttempts(0);
    setLockoutUntil(null);
    setCaptchaToken(null);

    // Check if 2FA is enabled for this user
    try {
      const response = await fetch('/api/auth/2fa/status');
      const twoFactorStatus = await response.json();
      if (response.ok && twoFactorStatus.enabled) {
        setTwoFactorUser(user);
        setShowTwoFactor(true);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error checking 2FA status:', error);
    }

    toast({
      title: 'Welcome back!',
      description: 'You have been signed in successfully.',
    });

    // Fetch user profile to determine role-based redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = normalizeRole(profile?.role) ?? 'customer';
    let redirectUrl: string;

    switch (userRole) {
      case 'admin':
        redirectUrl = '/mgmt/admin';
        break;
      case 'manager':
        redirectUrl = '/mgmt/manager';
        break;
      case 'sales':
      case 'service_engineer':
        redirectUrl = '/mgmt/sales';
        break;
      case 'accounts':
        redirectUrl = '/mgmt/accounts';
        break;
      case 'customer':
      default:
        redirectUrl = '/';
        break;
    }

    window.location.href = redirectUrl;
  };

  // ─── Shared sign-in error handler ──────────────────────────────────────────
  const handleSignInError = (signInError: any, isEmailFlow: boolean) => {
    const newFailedAttempts = failedAttempts + 1;
    setFailedAttempts(newFailedAttempts);

    if (newFailedAttempts >= 5) {
      const lockoutDuration = Math.min(300000, 60000 * Math.pow(2, newFailedAttempts - 5));
      setLockoutUntil(Date.now() + lockoutDuration);
      setError(`Too many failed attempts. Account locked for ${Math.ceil(lockoutDuration / 1000)} seconds.`);
      return;
    }

    if (signInError.message.includes('Invalid login credentials')) {
      setError(`Invalid ${isEmailFlow ? 'email' : 'mobile number'} or password. ${5 - newFailedAttempts} attempts remaining.`);
    } else if (isEmailFlow && signInError.message.includes('Email not confirmed')) {
      setError('Please verify your email address before signing in.');
    } else {
      setError(signInError.message);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      setError(`Account temporarily locked. Please wait ${lockoutTimeRemaining} seconds before trying again.`);
      return;
    }

    if (turnstileSiteKey && !captchaToken) {
      setError('Please complete the security check.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const normalized = identifier.trim();
      const isEmail = normalized.includes('@');

      if (isEmail) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });
        if (signInError) { handleSignInError(signInError, true); return; }
        if (data.user) await handleSignInSuccess(data.user);
      } else {
        const digits = normalized.replace(/\D/g, '');
        const phone = digits.length === 10 ? `91${digits}` : digits;

        // Resolve phone number to email using API
        const resolveRes = await fetch('/api/auth/resolve-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: phone }),
        });

        if (!resolveRes.ok) {
          setError('Failed to resolve phone account.');
          setIsLoading(false);
          return;
        }

        const resolveData = await resolveRes.json();
        const resolvedEmail = resolveData?.email;

        if (!resolvedEmail) {
          setError('No account found for this mobile number.');
          setIsLoading(false);
          return;
        }

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password,
        });
        if (signInError) { handleSignInError(signInError, false); return; }
        if (data.user) await handleSignInSuccess(data.user);
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-16">
      

      <div className="absolute inset-0 bg-noise opacity-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted border border-border mb-6 shadow-lg shadow-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tech-heading tracking-wide">SECURE ACCESS</h1>
          <p className="tech-body text-sm mt-2">Identify yourself to proceed to the console.</p>
        </div>

        <div className="login-card rounded-2xl p-8 border border-border bg-card">
          {!showTwoFactor ? (
            <>
              {verified === 'true' && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <div className="text-sm text-foreground">
                    <strong>Account created successfully!</strong>
                    <br />
                    Your email has been verified. You can now sign in.
                  </div>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-6">
                <div className="floating-label relative">
                  <Input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Mobile Number"
                    className="peer w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-primary transition-colors placeholder-transparent"
                    required
                  />
                  <Label htmlFor="identifier" className="absolute left-4 top-3 text-muted-foreground text-sm transition-all pointer-events-none">
                    Mobile Number
                  </Label>
                  <Phone className="absolute right-4 top-3.5 h-4 w-4 text-muted-foreground" />
                </div>

                <div className="floating-label relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="peer w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-primary transition-colors placeholder-transparent pr-12"
                    required
                  />
                  <Label htmlFor="password" className="absolute left-4 top-3 text-muted-foreground text-sm transition-all pointer-events-none">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                    <input id="remember-me" type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-0 bg-transparent animate-none cursor-pointer" />
                    Remember me
                  </label>
                  <a
                    href="/auth/forgot-password"
                    onClick={(e) => { e.preventDefault(); window.location.href = '/auth/forgot-password'; }}
                    className="text-primary hover:underline transition-colors"
                  >
                    Lost Key?
                  </a>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-200">{error}</span>
                  </div>
                )}

                {turnstileSiteKey && (
                  <div className="space-y-2 min-h-[85px]">
                    <Label className="text-sm font-medium text-muted-foreground">Security Check</Label>
                    <Turnstile
                      sitekey={turnstileSiteKey}
                      action="signin"
                      theme="dark"
                      size="normal"
                      retry="auto"
                      refreshExpired="auto"
                      appearance="always"
                      onVerify={(token: string) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={(captchaError: unknown) => {
                        setCaptchaToken(null);
                        console.error('Turnstile render failed:', captchaError);
                        setError('Security check failed to load. Please refresh the page or disable browser tracking protection for this site.');
                      }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="group relative w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide rounded-lg transition-colors flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] overflow-hidden cursor-pointer"
                  disabled={isLoading || !identifier || !password || isLockedOut}
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                  {isLoading ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      Signing in...
                    </>
                  ) : isLockedOut ? (
                    `Locked (${lockoutTimeRemaining}s)`
                  ) : (
                    'Authenticate'
                  )}
                </button>
              </form>

              {failedAttempts > 0 && failedAttempts < 5 && (
                <div className="mt-4 text-center text-sm text-amber-500">
                  {5 - failedAttempts} attempts remaining before account lockout
                </div>
              )}

              <p className="text-center mt-8 text-sm text-muted-foreground">
                New to the network?{' '}
                <button
                  type="button"
                  onClick={() => window.location.href = '/auth/signup'}
                  className="text-primary font-semibold hover:underline cursor-pointer"
                >
                  Initialize Account
                </button>
              </p>
            </>
          ) : (
            <TwoFactorVerification
              email={twoFactorUser?.email || ''}
              onVerify={handleTwoFactorVerify}
              onCancel={handleTwoFactorCancel}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
