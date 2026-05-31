'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Mail, RefreshCw, ArrowLeft, CheckCircle } from 'lucide-react';

import Link from 'next/link';

import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function EmailVerificationContent() {
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const supabase = createClient();

  const resendConfirmationEmail = async () => {
    if (!email) {
      setResendStatus('error');
      return;
    }

    setIsResending(true);
    setResendStatus('idle');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (error) {
        console.error('Resend error:', error);
        
        // Provide more detailed error information
        if (error.message?.includes('rate limit') || error.message?.includes('10 seconds')) {
          setResendStatus('error');
          // Show user-friendly rate limiting message
        } else if (error.message?.includes('Email not confirmed')) {
          setResendStatus('error');
          // Email service configuration issue
        } else if (error.message?.includes('Invalid API key') || error.message?.includes('unauthorized')) {
          setResendStatus('error');
          // Authentication configuration issue
        } else {
          setResendStatus('error');

        }
      } else {
        setResendStatus('success');
      }
    } catch (err) {
      console.error('Unexpected error during resend:', err);
      setResendStatus('error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-300" />
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            We've sent a verification link to your email address
          </p>
        </div>
        
        <Card className="border-white/10 bg-slate-900/60">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-cyan-500/10">
              <Mail className="h-6 w-6 text-cyan-300" />
            </div>
            <CardTitle className="text-xl">Verify your email address</CardTitle>
            <CardDescription>
              {email ? (
                <>We've sent a verification email to <strong>{email}</strong></>
              ) : (
                'Check your email for a verification link'
              )}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-300 space-y-2">
              <p>To complete your registration:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Check your email inbox</li>
                <li>Click the verification link in the email</li>
                <li>You'll be redirected back to sign in</li>
              </ol>
            </div>
            
            {resendStatus === 'success' && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
                <p className="text-sm text-emerald-200">
                  ✓ Verification email sent successfully!
                </p>
              </div>
            )}
            
            {resendStatus === 'error' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
                <p className="text-sm text-red-200">
                  Failed to send verification email. Please try again.
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              {email && (
                <Button
                  onClick={resendConfirmationEmail}
                  disabled={isResending}
                  variant="outline"
                  className="w-full"
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Resend verification email
                    </>
                  )}
                </Button>
              )}
              
              <Link href="/auth/signin" className="block">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to sign in
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        
        <div className="text-center text-sm text-gray-600">
          <p>Didn't receive the email? Check your spam folder or contact support.</p>
        </div>
      </div>
    </div>
  );
}
