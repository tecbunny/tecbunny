'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Send,
} from 'lucide-react';

import { logger } from '@/lib/logger';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePageContent } from '../hooks/use-page-content';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '../hooks/use-toast';
import { useAnalytics } from '../hooks/use-analytics';

const SUBJECT_OPTIONS = ['general', 'support', 'sales', 'billing', 'partnership', 'feedback', 'web_development'] as const;
const SUBJECT_LABELS: Record<(typeof SUBJECT_OPTIONS)[number], string> = {
  general: 'General Inquiry',
  support: 'Technical Support',
  sales: 'Sales Question',
  billing: 'Billing Issue',
  partnership: 'Partnership',
  feedback: 'Feedback',
  web_development: 'Web Development Inquiry',
};

const SUBJECT_SELECT_OPTIONS = SUBJECT_OPTIONS.map(value => ({
  value,
  label: SUBJECT_LABELS[value],
}));

const contactSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  phone: z.string().min(10, { message: 'Please enter a valid phone number.' }),
  subject: z.enum(SUBJECT_OPTIONS, { message: 'Please select a subject.' }),
  message: z.string().min(10, { message: 'Message must be at least 10 characters.' }),
  privacyConsent: z.boolean().refine((val) => val === true, { message: 'Please accept the Privacy Policy to proceed.' }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get('subject');
  const serviceParam = searchParams.get('service');
  const intentParam = searchParams.get('intent');
  const messageParam = searchParams.get('message');
  const defaultSubject = (subjectParam && SUBJECT_OPTIONS.includes(subjectParam as any)) 
    ? (subjectParam as typeof SUBJECT_OPTIONS[number]) 
    : SUBJECT_OPTIONS[0];

  const { toast } = useToast();
  const { trackEvent } = useAnalytics();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [companyInfo, setCompanyInfo] = React.useState<{supportEmail?: string; supportPhone?: string; registeredAddress?: string}>({});
  const [activeFaq, setActiveFaq] = React.useState<number | null>(0);
  const { content, loading } = usePageContent('contact_us');

  // Icon mapping for dynamic content
  const iconMap: Record<string, React.ComponentType<any>> = {
    MapPin,
    Phone,
    Mail,
  };

  // Load social media links
  React.useEffect(() => {
    // Load static business info extracted from PDFs
    fetch('/company-info.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setCompanyInfo(data))
      .catch(() => {});

  }, []);


  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: defaultSubject,
      message: '',
      privacyConsent: false,
    },
  });

  React.useEffect(() => {
    if (!messageParam) return;
    const currentMessage = form.getValues('message');
    if (currentMessage.trim().length > 0) return;

    form.setValue('message', messageParam, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
  }, [form, messageParam]);

  const onSubmit = async (values: ContactFormValues) => {
    setIsSubmitting(true);
    try {
      const normalizedSubject = SUBJECT_LABELS[values.subject] ?? values.subject;
      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        subject: normalizedSubject,
        message: values.message.trim(),
      };

      const response = await fetch('/api/contact-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = 'We could not send your message. Please try again later.';
        try {
          const data = await response.json();
          if (typeof data?.error === 'string' && data.error.length > 0) {
            errorMessage = data.error;
          }
        } catch (parseError) {
          logger.warn('contact_message_response_parse_failed', {
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
        throw new Error(errorMessage);
      }

      toast({
        title: 'Message sent!',
        description: "Thank you for contacting us. We'll get back to you within 24 hours.",
      });

      void trackEvent('contact_form_submit', {
        subject: normalizedSubject,
        service: serviceParam ?? undefined,
        intent: intentParam ?? undefined,
      });

      form.reset({
        name: '',
        email: '',
        phone: '',
        subject: defaultSubject,
        message: '',
        privacyConsent: false,
      });
    } catch (error) {
      logger.error('contact_message_submit_failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      toast({
        variant: 'destructive',
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'We could not send your message. Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqItems = [
    {
      question: 'Do you offer site visits?',
      answer:
        'Yes, we provide site consultation visits in North Goa. For standard repairs, a visit charge of ₹999 applies, waived for major installations.',
    },
    {
      question: 'How fast is installation?',
      answer:
        'For standard home setups (up to 8 cameras), installation is typically completed within 24-48 hours of confirmation.',
    },
    {
      question: 'What does AMC cover?',
      answer:
        'AMC plans include regular maintenance, software updates, lens cleaning, and priority breakdown support. Hardware replacement costs are separate unless covered by warranty.',
    },
  ];

  return (
    <section className="relative overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
      <div className="pointer-events-none absolute left-20 top-20 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-0 sm:px-6 lg:px-8 sm:pt-0">
        <div className="text-center">
          <h1 className="text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
            {content?.content?.hero?.title || 'Initialize'}{' '}
            <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Protocol.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
            {content?.content?.hero?.description ||
              'Ready to secure your premises? Our team in Parse, Goa is on standby for site visits, repairs, and consultations.'}
          </p>
        </div>

        {loading ? (
          <div className="mt-16 grid gap-12 lg:grid-cols-2">
            <div className="space-y-10">
              <div className="grid gap-6 sm:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 animate-pulse">
                    <div className="h-10 w-10 rounded-lg bg-slate-800 mb-4" />
                    <div className="h-6 w-3/4 bg-slate-800 rounded mb-2" />
                    <div className="h-4 w-full bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <div className="h-8 w-48 bg-slate-800 rounded animate-pulse mb-4" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 w-full bg-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-8 min-h-[600px] flex items-center justify-center">
               <div className="text-center">
                 <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-300" />
                 <p className="text-sm text-slate-400">Loading contact information...</p>
               </div>
            </div>
          </div>
        ) : (
          <div className="mt-16 grid gap-12 lg:grid-cols-2">
            <div className="space-y-10">
              <div className="grid gap-6 sm:grid-cols-2">
                {((content?.content?.contactInfo as any[]) || [
                  {
                    icon: 'MapPin',
                    title: 'HQ Location',
                    details: [
                      companyInfo.registeredAddress || 'Parcem, Pernem, Goa - 403512',
                      { text: 'Directions', href: 'https://maps.app.goo.gl/HZDjt3zoB1Rcrjqp8' },
                    ],
                  },
                  {
                    icon: 'Phone',
                    title: 'WhatsApp Support',
                    details: [
                      { text: '+91 96041 36010', href: 'https://wa.me/919604136010' },
                      { text: companyInfo.supportEmail || 'support@tecbunny.com', href: `mailto:${companyInfo.supportEmail || 'support@tecbunny.com'}` },
                    ],
                  },
                ]).map((info: any, index: number) => {
                  const IconComponent = iconMap[info.icon] || Mail;
                  return (
                    <div key={index} className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-white">{info.title}</h3>
                      {info.details.map((detail: any, idx: number) => {
                        const text = typeof detail === 'string' ? detail : detail?.text;
                        const href = typeof detail === 'object' ? detail?.href : undefined;

                        if (!text) return null;

                        return href ? (
                          <a
                            key={idx}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              void trackEvent('contact_channel_click', {
                                title: info.title,
                                destination: href,
                              });
                            }}
                            className="mt-1 block text-sm text-cyan-300 hover:text-cyan-200"
                          >
                            {text}
                          </a>
                        ) : (
                          <p key={idx} className="mt-1 text-sm text-slate-400">
                            {text}
                          </p>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
                  <span className="h-6 w-1 rounded-full bg-cyan-400" /> Common Queries
                </h3>
                <div className="space-y-4">
                  {faqItems.map((item, index) => (
                    <div key={item.question} className="rounded-xl border border-white/10 bg-white/5">
                      <button
                        type="button"
                        onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                        className="flex w-full items-center justify-between px-5 py-4 text-left"
                      >
                        <span className="text-sm font-medium text-white">{item.question}</span>
                        <span className={`text-cyan-300 transition-transform ${activeFaq === index ? 'rotate-180' : ''}`}>
                          ▾
                        </span>
                      </button>
                      {activeFaq === index && (
                        <div className="border-t border-white/10 px-5 pb-4 text-sm text-slate-400">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-violet-500/30 blur-xl" />
              <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-8">
                <h3 className="text-2xl font-semibold text-white">Send Transmission</h3>
                <p className="mt-2 text-sm text-slate-400">We&apos;ll respond within 24 hours. Use this form for quotes, demos, and site-survey requests.</p>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm text-slate-300">Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Your name"
                                {...field}
                                disabled={isSubmitting}
                                className="border-white/10 bg-white/5 text-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm text-slate-300">Phone</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="+91 98765 43210"
                                {...field}
                                disabled={isSubmitting}
                                className="border-white/10 bg-white/5 text-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-slate-300">Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="your.email@example.com"
                              {...field}
                              disabled={isSubmitting}
                              className="border-white/10 bg-white/5 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-slate-300">Service Interest</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                            <FormControl>
                              <SelectTrigger className="border-white/10 bg-white/5 text-white" aria-label="Service interest">
                                <SelectValue placeholder="Select Service Interest" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SUBJECT_SELECT_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-slate-300">Message</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={4}
                              placeholder="Tell us how we can help you..."
                              {...field}
                              disabled={isSubmitting}
                              className="border-white/10 bg-white/5 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="privacyConsent"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isSubmitting}
                              className="mt-1"
                              aria-label="I agree to the privacy policy and contact consent"
                            />
                          </FormControl>
                          <div className="space-y-1 text-sm text-slate-300">
                            <FormLabel className="text-sm text-white">Privacy consent</FormLabel>
                            <p className="text-xs text-slate-400">
                              I agree to the
                              {' '}
                              <Link href="/info/policies/privacy" className="text-cyan-300 hover:text-white underline">
                                Privacy Policy
                              </Link>
                              {' '}and allow Tecbunny to contact me regarding my enquiry.
                            </p>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full bg-cyan-400 text-slate-950 hover:bg-white" disabled={isSubmitting}>
                      {isSubmitting ? 'Sending...' : <span className="flex items-center gap-2">Submit Request <Send className="h-4 w-4" /></span>}
                    </Button>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        )}
      </div>

      <section className="relative h-96 border-t border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950" />
        <iframe
          title="Tecbunny Solutions Location"
          src="https://www.google.com/maps?q=15.6730616,73.7855133&z=17&output=embed"
          className="h-full w-full border-0"
          loading="lazy"
          allowFullScreen
          data-cookieconsent="marketing"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div className="absolute h-4 w-4 animate-ping rounded-full bg-cyan-400" />
          <div className="relative h-4 w-4 rounded-full border-2 border-slate-950 bg-cyan-400" />
          <div className="mt-2 rounded bg-slate-950/90 px-3 py-1 text-xs font-semibold text-cyan-300">Operational Base</div>
        </div>
      </section>
    </section>
  );
}