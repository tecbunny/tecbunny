'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NextDynamic from 'next/dynamic';

import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../lib/hooks';
import { useToast } from '../../hooks/use-toast';
import { createClient } from '../../lib/supabase/client';
import { logger } from '../../lib/logger';
import { normalizeRole } from '../../lib/roles';

const loginSchema = z.object({
  identifier: z.string().min(3, { message: 'Email or mobile is required.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { login, user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [failedAttempts, setFailedAttempts] = React.useState(0);
  const [lockoutUntil, setLockoutUntil] = React.useState<number | null>(null);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const captchaDisabled = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DISABLE_CAPTCHA === 'true';
  
  const Turnstile = React.useMemo(
    () => NextDynamic(() => import('react-turnstile').then(m => m.default), { ssr: false }) as unknown as React.ComponentType<any>,
    []
  );

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  // Check if account is locked out
  const isLockedOut = React.useMemo(() => {
    if (!lockoutUntil) return false;
    return Date.now() < lockoutUntil;
  }, [lockoutUntil]);

  // Calculate remaining lockout time
  const lockoutTimeRemaining = React.useMemo(() => {
    if (!isLockedOut || !lockoutUntil) return 0;
    return Math.ceil((lockoutUntil - Date.now()) / 1000);
  }, [isLockedOut, lockoutUntil]);

  const handleLogin = async (data: LoginFormValues) => {
    if (isLockedOut) {
      toast({
        variant: 'destructive',
        title: 'Account Temporarily Locked',
        description: `Please wait ${lockoutTimeRemaining} seconds before trying again.`,
      });
      return;
    }

    if (!!turnstileSiteKey && !captchaDisabled && !captchaToken) {
      toast({ 
        variant: 'destructive', 
        title: 'Security Verification Required', 
        description: 'Please complete the CAPTCHA to continue.' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const loginResult = await login(data.identifier, data.password);
      
      if (!loginResult.success) {
        toast({
          title: 'Login Failed',
          description: loginResult.message,
          variant: 'destructive',
        });
        setFailedAttempts(prev => prev + 1);
        return;
      }

      toast({
          title: 'Login Successful',
          description: 'Welcome back!',
      });
      setOpen(false);
      setFailedAttempts(0); // Reset on successful login
      setLockoutUntil(null);
      setCaptchaToken(null);
      
      // Wait for auth state to be fully updated before redirecting
      if (loginResult?.data?.user?.id) {
        try {
          const supabase = createClient();
          const userId = loginResult.data?.user?.id;
          if (!userId) return;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
          
          const userRole = normalizeRole(profile?.role) ?? 'customer';
          
          // Wait a bit longer for AuthProvider state to update
          await new Promise(resolve => setTimeout(resolve, 500));
          
          let redirectUrl: string;
          
          switch (userRole) {
            case 'admin':
              redirectUrl = '/management/admin';
              break;
            case 'sales':
            case 'manager':
            case 'service_engineer':
              redirectUrl = '/management/sales';
              break;
            case 'accounts':
              redirectUrl = '/management/accounts';
              break;
            case 'customer':
            default:
              redirectUrl = '/'; // Homepage for customers
              break;
          }
          
          // For customers on homepage, force refresh to update UI state
          if (userRole === 'customer' && window.location.pathname === redirectUrl) {
            window.location.reload();
          } else if (userRole !== 'customer' || window.location.pathname !== redirectUrl) {
            router.push(redirectUrl);
          }
        } catch (error) {
          logger.error('Error getting user profile for redirect in LoginDialog', { error, userId: user?.id });
          // For customers, no need to redirect if already on homepage
          if (window.location.pathname !== '/') {
            router.push('/');
          }
        }
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Increment failed attempts
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);

      // Implement progressive lockout
      if (newFailedAttempts >= 5) {
        const lockoutDuration = Math.min(300000, 60000 * Math.pow(2, newFailedAttempts - 5)); // Max 5 minutes
        setLockoutUntil(Date.now() + lockoutDuration);
        toast({
          variant: 'destructive',
          title: 'Too Many Failed Attempts',
          description: `Account locked for ${Math.ceil(lockoutDuration / 1000)} seconds.`,
        });
        return;
      }
      
      // Check if it's an email confirmation error
      if (errorMessage.includes('Email not confirmed') || errorMessage.includes('confirmation link')) {
        toast({
          variant: 'destructive',
          title: 'Email Not Verified',
          description: 'Please verify your email with the code sent to your inbox.',
          action: (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setOpen(false);
                window.location.href = `/auth/verify-otp?email=${encodeURIComponent(data.identifier)}&type=email`;
              }}
            >
              Verify Email
            </Button>
          ),
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: errorMessage,
        });
      }
    } finally {
        setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (user) {
        setOpen(false);
        // Redirect based on role
        switch(user.role) {
            case 'admin':
                router.push('/management/admin');
                break;
            case 'sales':
            case 'manager':
            case 'service_engineer':
                router.push('/management/sales');
                break;
            case 'accounts':
                router.push('/management/accounts');
                break;
            default:
                // No redirect for customer, just close dialog
                break;
        }
    }
  }, [user, router]);


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Login</DialogTitle>
          <DialogDescription className="text-center">
            Enter your email or mobile number to login.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email or Mobile</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your email or mobile" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || isLockedOut || (!!turnstileSiteKey && !captchaDisabled && !captchaToken)}
            >
                {isSubmitting ? 'Logging in...' : isLockedOut ? `Locked (${lockoutTimeRemaining}s)` : 'Login'}
            </Button>

            {!!turnstileSiteKey && !captchaDisabled && (
              <div className="mt-3">
                <Turnstile
                  sitekey={turnstileSiteKey}
                  onVerify={(token: string) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              </div>
            )}
          </form>
        </Form>

        {/* Remove old Turnstile component */}
        
        {failedAttempts > 0 && failedAttempts < 5 && (
          <div className="mt-2 text-center text-sm text-orange-600">
            {5 - failedAttempts} attempts remaining before account lockout
          </div>
        )}
        
        <div className="mt-4 text-center space-y-2">
          {/* Force full reload on forgot password */}
          <a
            href="/auth/forgot-password"
            onClick={(e) => { e.preventDefault(); window.location.href = '/auth/forgot-password'; }}
            className="text-sm text-blue-600 hover:text-blue-500 block"
          >
            Forgot your password?
          </a>
          
          <div className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="underline text-blue-600 hover:text-blue-500">
              Create account
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}