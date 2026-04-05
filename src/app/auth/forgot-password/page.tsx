'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Lock, Eye, EyeOff, KeyRound, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';

import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useToast } from '../../../hooks/use-toast';

type Step = 'request' | 'verify';

function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpId, setOtpId] = useState('');
  const [channel, setChannel] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  const isEmail = identifier.includes('@');

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your email or mobile number.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const body: Record<string, string> = {};
      if (isEmail) {
        body.email = identifier.trim();
      } else {
        body.mobile = identifier.trim().replace(/\D/g, '');
      }

      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send reset code. Please try again.');
        return;
      }

      setOtpId(data.otpId);
      setChannel(data.channel || 'email');
      setStep('verify');
      toast({
        title: 'Reset code sent!',
        description: data.message || `A reset code has been sent via ${data.channel}.`,
      });
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length < 4) {
      setError('Please enter the verification code.');
      return;
    }

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const body: Record<string, string> = {
        otp,
        otpId,
        password: newPassword,
      };

      if (isEmail) {
        body.email = identifier.trim();
      } else {
        body.mobile = identifier.trim().replace(/\D/g, '');
      }

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password. Please try again.');
        return;
      }

      toast({
        title: 'Password reset successful!',
        description: 'Your password has been updated. You can now sign in.',
      });

      router.push('/auth/signin');
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'Email';

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 flex items-center justify-center px-4 py-16">
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-400/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900/60 border border-white/10 mb-6 shadow-lg shadow-cyan-400/10">
            <KeyRound className="h-8 w-8 text-cyan-300" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">
            {step === 'request' ? 'RECOVER ACCESS' : 'RESET PASSWORD'}
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            {step === 'request'
              ? 'Enter your email or mobile to receive a reset code.'
              : `Enter the code sent via ${channelLabel} and your new password.`}
          </p>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 0 40px rgba(6, 182, 212, 0.1)',
          }}
          className="rounded-2xl p-8"
        >
          {step === 'request' ? (
            <form onSubmit={handleRequestOTP} className="space-y-6">
              <div className="relative">
                <Input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                  placeholder="Email or Mobile Number"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-400 transition-colors pr-12"
                  required
                  autoComplete="email"
                />
                <Label htmlFor="identifier" className="sr-only">Email or Mobile Number</Label>
                {isEmail
                  ? <Mail className="absolute right-4 top-3.5 h-4 w-4 text-slate-500" />
                  : <Phone className="absolute right-4 top-3.5 h-4 w-4 text-slate-500" />
                }
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-300 flex-shrink-0" />
                  <span className="text-sm text-red-200">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !identifier.trim()}
                className="group relative w-full py-3 bg-cyan-400 hover:bg-white text-slate-900 font-bold tracking-wide rounded-lg transition-colors flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                {isLoading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    Sending Code...
                  </>
                ) : (
                  'Send Reset Code'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-emerald-300 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-emerald-200">
                  Reset code sent via <strong>{channelLabel}</strong> to <strong>{identifier}</strong>
                </span>
              </div>

              <div>
                <Label htmlFor="otp" className="text-sm font-medium text-slate-300 mb-1 block">
                  Verification Code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }}
                  placeholder="Enter OTP code"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-center tracking-widest text-lg outline-none focus:border-cyan-400 transition-colors"
                  required
                  autoComplete="one-time-code"
                />
              </div>

              <div className="relative">
                <Label htmlFor="new-password" className="text-sm font-medium text-slate-300 mb-1 block">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="New password"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-400 transition-colors pr-12"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-slate-500 hover:text-cyan-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="relative">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-slate-300 mb-1 block">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="Confirm new password"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-400 transition-colors pr-12"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-3.5 text-slate-500 hover:text-cyan-300 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Password must be at least 8 characters with uppercase, lowercase, number, and special character.
              </p>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-300 flex-shrink-0" />
                  <span className="text-sm text-red-200">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !otp || !newPassword || !confirmPassword}
                className="group relative w-full py-3 bg-cyan-400 hover:bg-white text-slate-900 font-bold tracking-wide rounded-lg transition-colors flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                {isLoading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Reset Password
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('request'); setOtp(''); setNewPassword(''); setConfirmPassword(''); setError(''); }}
                className="w-full text-sm text-slate-400 hover:text-cyan-300 transition-colors text-center flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-3 w-3" />
                Try a different email or mobile
              </button>
            </form>
          )}

          <p className="text-center mt-8 text-sm text-slate-500">
            Remembered your password?{' '}
            <button
              type="button"
              onClick={() => router.push('/auth/signin')}
              className="text-cyan-300 font-semibold hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#030712] text-slate-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-300 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}
