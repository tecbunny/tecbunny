'use client';

import { useState } from 'react';

import { Shield, Key } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '../../hooks/use-toast';

interface TwoFactorVerificationProps {
  email: string;
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function TwoFactorVerification({
  email,
  onVerify,
  onCancel,
  isLoading
}: TwoFactorVerificationProps) {
  const [code, setCode] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter a valid 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    await onVerify(code);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-border bg-card text-foreground shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tech-heading">
            Two-Factor Authentication
          </CardTitle>
          <CardDescription className="tech-body">
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <Key className="h-5 w-5 text-primary" />
              <div className="text-sm text-foreground">
                <strong>Verification Required</strong>
                <br />
                Enter the code from your authenticator app for <strong>{email}</strong>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                className="text-center text-lg tracking-widest"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
              />
              <p className="text-xs text-slate-400 text-center">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Verify & Continue
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="w-full"
              >
                Back to Sign In
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <div className="text-sm text-slate-300 space-y-2">
              <p>
                <strong>Don't have access to your authenticator?</strong>
              </p>
              <p className="text-xs text-slate-400">
                You can also use one of your backup codes if you have them saved.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}