'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import NextDynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { User, Lock, Eye, EyeOff, AlertCircle, ShieldAlert, Terminal } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { normalizeRole } from '@/lib/roles';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

function SuperadminSignInForm() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (turnstileSiteKey && !captchaToken) {
      setError('Please complete the security check.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/superadmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.trim(),
          password,
          captchaToken
        })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Authentication failed. Invalid credentials.');
        return;
      }

      toast({
        title: 'System Access Granted',
        description: 'Authorized as System Super Administrator.',
      });

      // Clear Turnstile and redirect
      setCaptchaToken(null);
      window.location.href = '/superadmin/mgmt/dashboard';
    } catch (err) {
      console.error('Superadmin sign-in error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background radial effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted border border-primary/30 mb-5 shadow-lg shadow-primary/10">
            <ShieldAlert className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-widest uppercase">TecBunny Root Console</h1>
          <p className="text-muted-foreground text-xs mt-2 uppercase tracking-wider">System Super Administrator Only</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
            <Terminal className="h-3 w-3" />
            console.tecbunny.internal
          </div>
        </div>

        <div className="bg-card/85 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSignIn} className="space-y-5">
            {/* User ID */}
            <div className="relative">
              <Label htmlFor="superadmin-user-id" className="text-xs text-muted-foreground mb-1.5 block">
                Superadmin User ID
              </Label>
              <div className="relative">
                <Input
                  id="superadmin-user-id"
                  type="text"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder="superadmin"
                  className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-primary transition-colors pr-10"
                  required
                  autoComplete="username"
                />
                <User className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
              </div>
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="superadmin-password" className="text-xs text-muted-foreground mb-1.5 block">
                Root Password
              </Label>
              <div className="relative">
                <Input
                  id="superadmin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-primary transition-colors pr-12"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-muted-foreground/60 hover:text-primary transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                <span className="text-sm text-rose-600 dark:text-rose-300">{error}</span>
              </div>
            )}

            {/* Turnstile Captcha */}
            {turnstileSiteKey && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Security Ingestion Check</Label>
                <Turnstile
                  sitekey={turnstileSiteKey}
                  action="superadmin_signin"
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !userId || !password}
              className="group relative w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold tracking-widest uppercase rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg overflow-hidden"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-700" />
              {isLoading ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Establish Session
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SuperadminSignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <SuperadminSignInForm />
    </Suspense>
  );
}
