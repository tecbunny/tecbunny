'use client';

import { useState, useEffect, useCallback } from 'react';

import { Shield, QrCode, Copy, CheckCircle, AlertCircle, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '../../hooks/use-toast';
import { logger } from '@/lib/logger';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface SetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'complete'>('setup');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const initiateSetup = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate 2FA setup');
      }

      setSetupData(data);
    } catch (error) {
      logger.error('Setup error in TwoFactorSetup', { error });
      toast({
        title: 'Setup failed',
        description: error instanceof Error ? error.message : 'Failed to setup 2FA',
        variant: 'destructive',
      });
      onCancel();
    } finally {
      setIsLoading(false);
    }
  }, [toast, onCancel]);

  useEffect(() => {
    // Start 2FA setup
    initiateSetup();
  }, [initiateSetup]);

  const verifyAndEnable = async () => {
    if (!setupData || !verificationCode) {
      toast({
        title: 'Verification required',
        description: 'Please enter the verification code',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: setupData.secret,
          backupCodes: setupData.backupCodes,
          verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable 2FA');
      }

      setStep('complete');
      toast({
        title: '2FA enabled',
        description: '2FA has been successfully enabled!',
      });
    } catch (error) {
      logger.error('Verification error in TwoFactorSetup', { error });
      toast({
        title: 'Verification failed',
        description: error instanceof Error ? error.message : 'Failed to verify code',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodes(prev => new Set([...prev, index]));
      toast({
        title: 'Copied',
        description: 'Backup code copied!',
      });
      setTimeout(() => {
        setCopiedCodes(prev => {
          const newSet = new Set(prev);
          newSet.delete(index);
          return newSet;
        });
      }, 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy code',
        variant: 'destructive',
      });
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData) return;

    const codesText = setupData.backupCodes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2fa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Downloaded',
      description: 'Backup codes downloaded!',
    });
  };

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md border-border bg-card text-foreground shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-bold tech-heading">
              2FA Setup Complete!
            </CardTitle>
            <CardDescription className="tech-body">
              Your account is now protected with two-factor authentication
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Make sure to save your backup codes in a safe place.
                  You'll need them if you lose access to your authenticator app.
                </AlertDescription>
              </Alert>

              <Button onClick={onComplete} className="w-full" size="lg">
                Continue to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md border-border bg-card text-foreground shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold tech-heading">
              Verify Setup
            </CardTitle>
            <CardDescription className="tech-body">
              Enter the 6-digit code from your authenticator app to complete setup
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); verifyAndEnable(); }} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code</Label>
                <Input
                  id="verificationCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  className="text-center text-lg tracking-widest"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                />
              </div>

              <div className="space-y-3">
                <Button
                  type="submit"
                  disabled={isLoading || verificationCode.length !== 6}
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
                      Enable 2FA
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('setup')}
                  disabled={isLoading}
                  className="w-full"
                >
                  Back
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-2xl border-border bg-card text-foreground shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tech-heading">
            Setup Two-Factor Authentication
          </CardTitle>
          <CardDescription className="tech-body">
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading && !setupData ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="tech-body">Setting up 2FA...</p>
            </div>
          ) : setupData ? (
            <div className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Step 1:</strong> Scan the QR code below with your authenticator app
                  (Google Authenticator, Authy, Microsoft Authenticator, etc.)
                </AlertDescription>
              </Alert>

              <div className="flex justify-center">
                <div className="p-4 bg-muted border border-border rounded-lg">
                  <img
                    src={setupData.qrCode}
                    alt="2FA QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm tech-body mb-2">
                  Or manually enter this code:
                </p>
                <code className="bg-muted px-3 py-1 rounded text-sm font-mono text-foreground">
                  {setupData.secret}
                </code>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Step 2:</strong> Save your backup codes below. You'll need them if you lose access to your authenticator app.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Backup Codes</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadBackupCodes}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {setupData.backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted border border-border rounded"
                    >
                      <code className="text-sm font-mono">{code}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyBackupCode(code, index)}
                      >
                        {copiedCodes.has(index) ? (
                          <CheckCircle className="h-4 w-4 text-emerald-300" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> Each backup code can only be used once. Store them securely and don't share them with anyone.
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={() => setStep('verify')}
                  className="flex-1"
                  size="lg"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  I've Scanned the QR Code
                </Button>

                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}