'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function VerificationSuccessContent() {
  const [countdown, setCountdown] = useState(5);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Auto-redirect to signin after countdown
      router.push(`/auth/signin?email=${encodeURIComponent(email)}&verified=true`);
    }
    // Return undefined explicitly for the else branch
    return undefined;
  }, [countdown, router, email]);

  const handleManualRedirect = () => {
    router.push(`/auth/signin?email=${encodeURIComponent(email)}&verified=true`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 text-foreground">
      <Card className="w-full max-w-md border-border bg-card shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/10 mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <CardTitle className="text-2xl font-bold tech-heading">
            Email Verified Successfully!
          </CardTitle>
          <CardDescription className="tech-body">
            Your account has been created and verified. You can now sign in to access your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {email && (
            <div className="text-center">
              <p className="text-sm tech-body">
                Verified email: <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>
          )}

          <div className="text-center space-y-4">
            <div className="text-sm tech-body">
              <p>Redirecting to sign in page in <span className="font-bold text-primary">{countdown}</span> seconds...</p>
            </div>

            <div className="flex flex-col space-y-3">
              <Button
                onClick={handleManualRedirect}
                className="w-full"
                size="lg"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Continue to Sign In
              </Button>

              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing your account...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerificationSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verification successful! Redirecting...</p>
        </div>
      </div>
    }>
      <VerificationSuccessContent />
    </Suspense>
  );
}
