'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import NextDynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

import { Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, Users } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { normalizeRole } from '@/lib/roles';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '../../../hooks/use-toast';
import { TwoFactorVerification } from '@/components/auth/TwoFactorVerification';

// Staff roles permitted to access the CRM/Management Panel
const STAFF_ROLES = new Set(['admin', 'manager', 'sales-staff', 'sales', 'sales-external']);

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  'sales-staff': 'Sales Staff',
  sales: 'Sales Staff',
  'sales-external': 'Sales Non-Staff (External)',
};

function StaffSignInForm() {
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
    () =>
      NextDynamic(() => import('react-turnstile').then(m => m.default), {
        ssr: false,
      }) as unknown as React.ComponentType<any>,
    []
  );

  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const denied = searchParams.get('denied');

  const isLockedOut = useMemo(() => {
    if (!lockoutUntil) return false;
    return Date.now() < lockoutUntil;
  }, [lockoutUntil]);

  const lockoutTimeRemaining = useMemo(() => {
    if (!isLockedOut || !lockoutUntil) return 0;
    return Math.ceil((lockoutUntil - Date.now()) / 1000);
  }, [isLockedOut, lockoutUntil]);

  // Auto-reset lockout display
  useEffect(() => {
    if (!isLockedOut) return;
    const id = window.setInterval(() => {
      if (lockoutUntil && Date.now() >= lockoutUntil) {
        setLockoutUntil(null);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isLockedOut, lockoutUntil]);

  const handleTwoFactorVerify = async (code: string) => {
    if (!twoFactorUser) return;
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId: twoFactorUser.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Invalid 2FA code.');
        return;
      }

      // Confirm role after 2FA
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', twoFactorUser.id)
        .single();

      let userRole = normalizeRole(profile?.role) ?? null;
      if (userRole === 'superadmin') {
        userRole = null;
      }

      if (!userRole || !STAFF_ROLES.has(userRole)) {
        await supabase.auth.signOut();
        setError('Access denied. This portal is for staff only. Please contact your administrator.');
        setShowTwoFactor(false);
        return;
      }

      window.location.href = getRedirectPath(userRole);
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
    supabase.auth.signOut();
  };

  function getRedirectPath(role: string): string {
    switch (role) {
      case 'admin':
        return '/mgmt/admin';
      case 'manager':
        return '/mgmt/manager';
      case 'sales-staff':
      case 'sales':
        return '/mgmt/sales-staff';
      case 'sales-external':
        return '/mgmt/sales-external';
      default:
        return '/mgmt';
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      setError(`Account temporarily locked. Please wait ${lockoutTimeRemaining} seconds.`);
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

      let authUser: any = null;
      let authError: any = null;

      if (isEmail) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });
        authUser = data?.user ?? null;
        authError = error;
      } else {
        const phone = normalized.replace(/\D/g, '');
        const { data, error } = await supabase.auth.signInWithPassword({
          phone,
          password,
        });
        authUser = data?.user ?? null;
        authError = error;
      }

      if (authError) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= 5) {
          const lockDuration = Math.min(300000, 60000 * Math.pow(2, newAttempts - 5));
          setLockoutUntil(Date.now() + lockDuration);
          setError(`Too many failed attempts. Locked for ${Math.ceil(lockDuration / 1000)} seconds.`);
          return;
        }
        if (authError.message.includes('Invalid login credentials')) {
          setError(`Invalid credentials. ${5 - newAttempts} attempts remaining.`);
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Please verify your email before signing in.');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (!authUser) {
        setError('Sign in failed. Please try again.');
        return;
      }

      setFailedAttempts(0);
      setLockoutUntil(null);
      setCaptchaToken(null);

      // Check 2FA
      try {
        const twoFaResponse = await fetch('/api/auth/2fa/status');
        const twoFaStatus = await twoFaResponse.json();
        if (twoFaResponse.ok && twoFaStatus.enabled) {
          setTwoFactorUser(authUser);
          setShowTwoFactor(true);
          setIsLoading(false);
          return;
        }
      } catch {
        // 2FA check failed, proceed without it
      }

      // Check staff role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .single();

      let userRole = normalizeRole(profile?.role) ?? null;
      if (userRole === 'superadmin') {
        userRole = null;
      }

      if (!userRole || !STAFF_ROLES.has(userRole)) {
        // Sign them out immediately — customer accounts are not allowed here
        await supabase.auth.signOut();
        setError(
          'Access denied. This portal is for TecBunny staff only. ' +
          'Customer accounts cannot log in here. Please visit tecbunny.com.'
        );
        return;
      }

      toast({
        title: `Welcome, ${ROLE_LABELS[userRole] ?? userRole}`,
        description: 'CRM access granted.',
      });

      window.location.href = getRedirectPath(userRole);
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 flex flex-col items-center justify-center px-4 py-16">
      

      {/* Background effects */}
      <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900/60 border border-indigo-500/20 mb-5 shadow-lg shadow-indigo-500/10">
            <ShieldCheck className="h-8 w-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">CRM Staff Portal</h1>
          <p className="text-slate-400 text-sm mt-2">TecBunny Solutions — Authorised Staff Only</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
            <Users className="h-3 w-3" />
            Staff Control Panel
          </div>
        </div>

        <div className="crm-card rounded-2xl p-8">
          {denied === '1' && !error && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
              <div className="text-sm text-red-200">
                <strong>Access denied.</strong> Your account does not have staff privileges. Contact your administrator.
              </div>
            </div>
          )}

          {!showTwoFactor ? (
            <form onSubmit={handleSignIn} className="space-y-5">
              {/* Email / Mobile */}
              <div className="relative">
                <Label htmlFor="staff-identifier" className="text-xs text-slate-400 mb-1.5 block">
                  Staff Email or Mobile
                </Label>
                <div className="relative">
                  <Input
                    id="staff-identifier"
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="staff@tecbunny.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-indigo-400 transition-colors pr-10"
                    required
                    autoComplete="username"
                  />
                  <Mail className="absolute right-3 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="staff-password" className="text-xs text-slate-400 mb-1.5 block">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="staff-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-indigo-400 transition-colors pr-12"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-indigo-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Forgot password */}
              <div className="flex justify-end">
                <a
                  href="/auth/forgot-password"
                  onClick={e => { e.preventDefault(); window.location.href = '/auth/forgot-password'; }}
                  className="text-xs text-indigo-300 hover:text-white transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-300 mt-0.5 shrink-0" />
                  <span className="text-sm text-red-200">{error}</span>
                </div>
              )}

              {/* CAPTCHA */}
              {turnstileSiteKey && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">Security Check</Label>
                  <Turnstile
                    sitekey={turnstileSiteKey}
                    action="staff_signin"
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

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !identifier || !password || isLockedOut}
                className="group relative w-full py-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold tracking-wide rounded-lg transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.25)] overflow-hidden"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                {isLoading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Verifying...
                  </>
                ) : isLockedOut ? (
                  `Locked (${lockoutTimeRemaining}s)`
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Sign In to CRM
                  </>
                )}
              </button>

              {failedAttempts > 0 && failedAttempts < 5 && (
                <p className="text-center text-xs text-amber-300">
                  {5 - failedAttempts} attempts remaining before lockout
                </p>
              )}
            </form>
          ) : (
            <TwoFactorVerification
              email={twoFactorUser?.email || ''}
              onVerify={handleTwoFactorVerify}
              onCancel={handleTwoFactorCancel}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Footer note */}
        <p className="text-center mt-6 text-xs text-slate-600">
          Customer? Visit{' '}
          <a href="https://www.tecbunny.com" className="text-slate-500 hover:text-slate-300 transition-colors underline">
            www.tecbunny.com
          </a>
        </p>
      </div>
    </div>
  );
}

export default function StaffSignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    }>
      <StaffSignInForm />
    </Suspense>
  );
}
