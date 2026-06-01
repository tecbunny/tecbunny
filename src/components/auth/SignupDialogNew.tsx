'use client';

import { useState, useMemo, useEffect } from 'react';
import NextDynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, MessageCircle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/hooks';
import { useToast } from '../../hooks/use-toast';
import { logger } from '@/lib/logger';
import { Checkbox } from '@/components/ui/checkbox';

type OTPChannel = 'email' | 'sms' | 'whatsapp';
type PreferredChannel = 'email' | 'whatsapp';

const signupSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  mobile: z.string().min(10, { message: 'Please enter a valid mobile number.' }),
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters.' })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, one special character (@$!%*?&), and only use allowed characters.',
    }),
  confirmPassword: z.string().min(8, { message: 'Please confirm your password.' }),
  privacyConsent: z.boolean().refine((val) => val === true, {
    message: 'Please accept the Privacy Policy and Terms to continue.',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { signup } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [preferredChannel, setPreferredChannel] = useState<PreferredChannel>('email');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const captchaDisabled = process.env.NEXT_PUBLIC_DISABLE_CAPTCHA === 'true';
  
  // Debug logging
  logger.debug('CAPTCHA configuration in SignupDialogNew', {
    turnstileSiteKey: !!turnstileSiteKey,
    captchaDisabled,
    shouldShowCaptcha: !!turnstileSiteKey && !captchaDisabled,
  });
  
  const Turnstile = useMemo(
    () => NextDynamic(() => import('react-turnstile').then(m => m.default), { ssr: false }) as unknown as React.ComponentType<any>,
    []
  );

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      mobile: '+91',
      password: '',
      confirmPassword: '',
      privacyConsent: false,
    },
  });

  const watchedMobile = form.watch('mobile');
  const privacyAccepted = form.watch('privacyConsent');
  const sanitizedMobile = useMemo(() => watchedMobile.replace(/\D/g, ''), [watchedMobile]);
  const phoneEnabled = sanitizedMobile.length >= 10;

  useEffect(() => {
    if (!phoneEnabled && preferredChannel === 'whatsapp') {
      setPreferredChannel('email');
    }
  }, [phoneEnabled, preferredChannel]);

  const onSubmit = async (values: SignupFormValues) => {
    // Check CAPTCHA before proceeding if Turnstile is enabled
    if (!!turnstileSiteKey && !captchaDisabled && !captchaToken) {
      toast({
        title: 'Security Verification Required',
        description: 'Please complete the CAPTCHA to continue.',
        variant: 'destructive',
      });
      return;
    }

    if (preferredChannel === 'whatsapp' && !phoneEnabled) {
      toast({
        title: 'Mobile number required',
        description: 'Add a valid mobile number to receive OTP via WhatsApp.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const signupResult = await signup({
        firstName: values.name.split(' ')[0] || values.name,
        lastName: values.name.split(' ').slice(1).join(' ') || '',
        email: values.email,
        password: values.password,
        phone: values.mobile,
        captchaToken: captchaToken || undefined,
        preferredChannel
      });

      if (!signupResult.success) {
        toast({
          title: 'Signup Failed',
          description: signupResult.message,
          variant: 'destructive',
        });
        return;
      }

      const otpId = signupResult.data?.otpId as string | undefined;
      const dispatchedChannel = (signupResult.data?.channel as OTPChannel | undefined) || preferredChannel;
      const fallbackAvailable = Boolean(signupResult.data?.fallbackAvailable);

      if (!otpId) {
        toast({
          title: 'Verification unavailable',
          description: 'Could not create a verification reference. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Verification code sent!',
        description: `We sent a code via ${dispatchedChannel === 'email' ? 'Email' : dispatchedChannel === 'sms' ? 'Automated Call' : 'WhatsApp'}.`,
      });
      setOpen(false);
      form.reset();
      setPreferredChannel('email');
      
      // Store signup data for account creation after OTP verification
      const signupData = {
        email: values.email,
        password: values.password, // Store password temporarily for account creation
        name: values.name,
        mobile: values.mobile,
        otpId,
        channel: dispatchedChannel,
        fallbackAvailable,
        timestamp: Date.now(),
      };
      
      try {
        localStorage.setItem('signup_session', JSON.stringify(signupData));
      } catch (storageError) {
        logger.error('Error storing signup data in SignupDialogNew', { storageError, email: values.email });
      }
      
      // Redirect to OTP verification page
      const query = new URLSearchParams({
        email: values.email,
        otpId,
        channel: dispatchedChannel,
        type: 'signup'
      });
      if (phoneEnabled) {
        query.set('mobile', sanitizedMobile);
      }
      window.location.href = `/auth/verify-otp?${query.toString()}`;
    } catch (error) {
      toast({
        title: 'Error creating account',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
          <DialogDescription>
            Create your account to start shopping and manage your orders.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter your email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="mobile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your mobile number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Verification Method</FormLabel>
              <div className="grid gap-2">
                {(['email', 'whatsapp'] as PreferredChannel[]).map(option => {
                  const isPhoneChannel = option === 'whatsapp';
                  const disabled = isPhoneChannel && !phoneEnabled;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => !disabled && setPreferredChannel(option)}
                      disabled={disabled}
                      className={`flex w-full flex-col rounded-lg border p-3 text-left transition ${
                        preferredChannel === option ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200' : 'border-white/10 bg-white/5 text-slate-200'
                      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-cyan-400/50 hover:bg-white/5'}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {option === 'email' ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                        {option === 'email' ? 'Email' : 'WhatsApp'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {option === 'email' && 'Send code to your email address'}
                        {option === 'whatsapp' && 'Send code via WhatsApp'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!phoneEnabled && watchedMobile && (
                <p className="text-xs text-slate-400">Add at least 10 digits to enable WhatsApp verification.</p>
              )}
            </div>
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Create a password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Confirm your password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="privacyConsent"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 rounded-lg border border-slate-200/20 p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                      className="mt-1"
                    />
                  </FormControl>
                  <div className="space-y-1 text-sm text-slate-600">
                    <FormLabel className="text-sm font-medium text-slate-900">Privacy & terms</FormLabel>
                    <p className="text-xs text-slate-500">
                      I agree to the
                      {' '}
                      <Link href="/info/policies/privacy" className="text-cyan-700 hover:text-cyan-900 underline">Privacy Policy</Link>
                      {' '}and
                      {' '}
                      <Link href="/info/policies/terms" className="text-cyan-700 hover:text-cyan-900 underline">Terms of Service</Link>.
                    </p>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            
            <div className="flex flex-col space-y-4 pt-4">
              <Button 
                type="submit" 
                disabled={isSubmitting || (!privacyAccepted) || (!!turnstileSiteKey && !captchaDisabled && !captchaToken)} 
                className="w-full"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
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
              
              <Separator />
              
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => setOpen(false)}
                >
                  Sign in instead
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}