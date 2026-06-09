'use client';

import * as React from 'react';
import Link from 'next/link';
import { Logo } from '../ui/logo';

import { Facebook, Twitter, Instagram, Linkedin, Youtube, Globe, FileText, Shield } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useAnalytics } from '../../hooks/use-analytics';

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            height="1em"
            width="1em"
            {...props}
        >
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2m.01 1.67c4.56 0 8.25 3.69 8.25 8.25 0 4.56-3.69 8.25-8.25 8.25-1.53 0-3-.42-4.29-1.19l-.3-.18-3.18.83.85-3.11-.2-.32a8.182 8.182 0 0 1-1.25-4.38c0-4.56 3.69-8.25 8.25-8.25M9.42 7.72l-.12.02c-.15.03-.3.06-.44.09-.15.03-.28.06-.41.1-.39.12-.76.3-1.09.56-.33.27-.63.6-.88.97-.27.41-.43.85-.43 1.32 0 .5.16.98.48 1.41.32.43.72.84 1.2 1.24.48.4 1 1.03 1.63 1.28.63.25 1.22.4 1.84.4.45 0 .86-.08 1.23-.25.37-.17.63-.38.83-.63.2-.25.32-.54.4-.85.08-.31.13-.64.13-1s-.05-.72-.13-1.03c-.08-.31-.2-.59-.4-.84-.2-.25-.46-.46-.83-.63-.37-.17-.78-.25-1.23-.25-.62 0-1.21.15-1.84.4-.05.02-.1.04-.15.07-.1.03-.18.07-.27.1-.1.03-.18.05-.28.07l-.17.04c-.06.01-.1.02-.12.02-.02 0-.04.01-.06.01-.02 0-.03 0-.03-.01s0-.01 0-.01l-.01-.01c0-.01.01-.02.01-.04 0-.02 0-.04.01-.06.01-.02.01-.04.02-.06a.7.7 0 0 1 .05-.12c.04-.08.08-.15.14-.23.06-.08.12-.15.2-.22.07-.07.15-.14.23-.2.08-.06.16-.12.25-.17.09-.05.18-.09.28-.13.05-.02.1-.04.13-.05.28-.11.53-.17.75-.17.22 0 .43.03.62.09.19.06.37.14.53.25.16.11.3.25.41.41s.19.34.24.54c.05.2.07.4.07.61 0 .02 0 .03 0 .03s0 .02 0 .02l-.01.03c0 .01-.01.02-.01.03 0 .01-.01.02-.02.03-.01.01-.02.02-.04.03l-.05.03-.06.03c-.02.01-.05.02-.08.03-.03.01-.06.02-.1.04-.04.01-.07.02-.11.04-.04.01-.07.03-.11.04-.04.02-.07.03-.1.05s-.07.04-.1.06-.06.04-.1.07c-.03.02-.06.04-.1.07l-.07.05c-.01 0-.01.01-.01.01s0 .01 0 .01l.01.01c.22-.12.44-.24.67-.35.23-.11.45-.24.67-.35.22-.11.44-.22.65-.33.21-.11.42-.22.62-.33l.2-.1c.14-.07.26-.15.39-.22.13-.07.25-.15.36-.24.11-.09.22-.18.31-.29s.18-.23.25-.36a2.64 2.64 0 0 0 .28-1.38c0-.52-.13-1-.39-1.44a3.17 3.17 0 0 0-1.08-1.21c-.4-.33-.86-.57-1.36-.72s-1.02-.22-1.56-.22c-.54 0-1.06.07-1.56.22s-.96.39-1.36.72c-.4.34-.72.75-.97 1.21-.25.46-.38.96-.38 1.51 0 .42.09.82.26 1.17.17.35.4.66.68.92.28.26.59.47.92.62.33.15.68.25 1.04.28h.1c.02 0 .03 0 .03-.01s0-.01 0-.01l-.01-.01c0-.01 0-.01.01-.02l.01-.02c0-.01.01-.02.01-.03l.01-.03c.01-.02.01-.03.01-.05 0-.02 0-.04.01-.06 0-.02.01-.04.01-.06a.71.71 0 0 0 0-.1c0-.04 0-.08-.02-.13s-.04-.1-.07-.15a.43.43 0 0 0-.1-.13c-.04-.04-.08-.08-.13-.11-.05-.03-.1-.06-.17-.08-.07-.02-.13-.04-.2-.06-.07-.02-.15-.03-.22-.04-.04-.01-.07-.01-.11-.02l-.11-.02h-.04z" />
        </svg>
    );
}

const DEFAULT_COMPANY_INFO = {
  supportEmail: 'support@tecbunny.com',
  supportPhone: '+91 96041 36010',
  registeredAddress: 'H NO 11 NHAYGINWADA, PARSE, Parxem, Pernem, North Goa - 403512, Goa',
  gstin: '30AAMCT1608G1ZO',
};

const FALLBACK_SOCIAL_LINKS = {
  facebookUrl: 'https://www.facebook.com/profile.php?id=61578165368064',
  instagramUrl: 'https://www.instagram.com/tecbunny_solutions/',
  twitterUrl: process.env.NEXT_PUBLIC_X_URL || '',
};

export function Footer() {
  const [companyInfo, setCompanyInfo] = React.useState<{supportEmail?: string; supportPhone?: string; registeredAddress?: string; gstin?: string}>(DEFAULT_COMPANY_INFO);
  const [socialLinks, setSocialLinks] = React.useState<Record<string, string>>({});
  const [subscribeEmail, setSubscribeEmail] = React.useState('');
  const [subscribeStatus, setSubscribeStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [subscribeMessage, setSubscribeMessage] = React.useState<string | null>(null);
  const isMountedRef = React.useRef(true);
  const subscribeAbortRef = React.useRef<AbortController | null>(null);
  const supabase = React.useMemo(() => createClient(), []);
  const { trackEvent } = useAnalytics();

  React.useEffect(() => {
    isMountedRef.current = true;
    fetch('/company-info.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setCompanyInfo(data))
      .catch(() => {});

    return () => {
      isMountedRef.current = false;
      subscribeAbortRef.current?.abort();
    };
  }, []);

  const handleSocialClick = (platform: string) => {
    trackEvent('social_click', { platform });
  };

  const handleSubscribe = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = subscribeEmail.trim().toLowerCase();

    if (!email || !/.+@.+\..+/.test(email)) {
      setSubscribeStatus('error');
      setSubscribeMessage('Please enter a valid email address.');
      return;
    }

    if (!isMountedRef.current) return;
    setSubscribeStatus('loading');
    setSubscribeMessage(null);

    try {
      subscribeAbortRef.current?.abort();
      const controller = new AbortController();
      subscribeAbortRef.current = controller;

      const response = await fetch('/api/contact-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          name: 'Newsletter Subscriber',
          email,
          subject: 'System Updates Subscription',
          message: 'Please subscribe me to system updates and product announcements.',
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Subscription failed. Please try again later.';
        try {
          const data = await response.json();
          if (typeof data?.error === 'string') {
            errorMessage = data.error;
          }
        } catch (parseError) {
          logger.warn('footer_subscribe_response_parse_failed', {
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
        throw new Error(errorMessage);
      }

      trackEvent('newsletter_subscribe', { status: 'success' });
      if (!isMountedRef.current) return;
      setSubscribeStatus('success');
      setSubscribeMessage('You are subscribed! We will keep you updated.');
      setSubscribeEmail('');
    } catch (error) {
      if (!isMountedRef.current) return;
      trackEvent('newsletter_subscribe', { status: 'error' });
      logger.error('footer_subscribe_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      setSubscribeStatus('error');
      setSubscribeMessage(error instanceof Error ? error.message : 'Subscription failed.');
    }
  };

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(
          '/api/settings?keys=facebookUrl,twitterUrl,instagramUrl,linkedinUrl,youtubeUrl,websiteUrl,phone,support_email'
        );
        if (!response.ok) {
          logger.error('Footer: failed to load settings from api', { status: response.status });
          setSocialLinks(FALLBACK_SOCIAL_LINKS);
          return;
        }

        const data = await response.json();
        const links: Record<string, string> = {};
        Object.keys(data).forEach((key) => {
          if (data[key] && !['phone', 'support_email'].includes(key)) {
            links[key] = data[key] as string;
          }
        });

        setSocialLinks({
          ...FALLBACK_SOCIAL_LINKS,
          ...links,
        });

        if (data.phone || data.support_email) {
          setCompanyInfo((current) => ({
            ...current,
            supportPhone: data.phone ? String(data.phone).trim() : current.supportPhone,
            supportEmail: data.support_email ? String(data.support_email).trim() : current.supportEmail,
          }));
        }
      } catch (error) {
        logger.error('Footer: unexpected error while loading settings', { error });
        setSocialLinks(FALLBACK_SOCIAL_LINKS);
      }
    };

    loadSettings();
  }, []);

  const supportEmail = companyInfo.supportEmail || DEFAULT_COMPANY_INFO.supportEmail;
  const supportPhone = companyInfo.supportPhone || DEFAULT_COMPANY_INFO.supportPhone;
  const address = companyInfo.registeredAddress || DEFAULT_COMPANY_INFO.registeredAddress;

  const socialPlatforms = React.useMemo(
    () => [
      { key: 'facebookUrl', icon: Facebook, label: 'Facebook' },
      { key: 'instagramUrl', icon: Instagram, label: 'Instagram' },
      { key: 'twitterUrl', icon: Twitter, label: 'X' },
      { key: 'linkedinUrl', icon: Linkedin, label: 'LinkedIn' },
      { key: 'youtubeUrl', icon: Youtube, label: 'YouTube' },
      { key: 'websiteUrl', icon: Globe, label: 'Website' },
    ],
    []
  );

  const activeSocialPlatforms = socialPlatforms.filter(({ key }) => Boolean(socialLinks[key]));

  return (
    <footer className="footer-custom relative overflow-hidden bg-[#030712] border-t border-white/10 pt-8 pb-6 sm:pt-12 sm:pb-8 font-sans shadow-[0_-4px_20px_rgba(6,182,212,0.05)]">
      <div className="absolute top-0 right-0 h-48 w-48 sm:h-64 sm:w-64 rounded-full bg-brand-purple/5 blur-[80px] pointer-events-none" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 mb-12 pb-12 border-b border-white/5">
          <div className="max-w-md">
            <Link href="/" className="flex items-center gap-3 mb-4 group">
              <Logo width={56} height={56} className="transition-transform group-hover:scale-105" />
              <span className="font-tech font-bold text-3xl sm:text-4xl text-white tracking-wide">
                TECBUNNY<span className="text-brand-cyan">.</span>
              </span>
            </Link>
            <p className="text-slate-400 text-base leading-relaxed">
              Transforming spaces into smart, secure sanctuaries. Goa&apos;s trusted partner for CCTV, IT infrastructure, and automation.
            </p>
          </div>

          <div className="w-full lg:w-auto">
            <h4 className="font-tech text-white text-lg font-bold mb-2 flex items-center gap-2">
              <span className="text-brand-purple">SYSTEM UPDATES</span>
            </h4>
            <p className="text-slate-400 text-sm mb-4 max-w-sm">
              Subscribe to receive critical security advisories, local threat alerts, and seasonal tech maintenance checklists for your business or home.
            </p>
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleSubscribe}>
              <input
                type="email"
                placeholder="Enter secure email..."
                value={subscribeEmail}
                onChange={(event) => {
                  setSubscribeEmail(event.target.value);
                  if (subscribeStatus !== 'idle') {
                    setSubscribeStatus('idle');
                    setSubscribeMessage(null);
                  }
                }}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-base text-white focus:outline-none focus:border-brand-cyan/50 w-full sm:w-72 placeholder-slate-600"
              />
              <button
                type="submit"
                disabled={subscribeStatus === 'loading'}
                className="w-full sm:w-auto px-6 py-3 bg-white/5 border border-white/10 hover:bg-brand-cyan hover:text-brand-dark hover:border-brand-cyan text-white text-base font-bold font-tech rounded-lg transition-all duration-300"
              >
                {subscribeStatus === 'loading' ? 'SUBSCRIBING...' : 'SUBSCRIBE'}
              </button>
            </form>
            {subscribeMessage && (
              <p
                className={`mt-3 text-xs ${subscribeStatus === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}
                role="status"
                aria-live="polite"
              >
                {subscribeMessage}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h4 className="text-brand-cyan text-sm font-bold uppercase tracking-widest mb-6">Services</h4>
            <ul className="space-y-3 text-base text-slate-300">
              <li>
                <Link href="/services" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-brand-purple" /> CCTV Installation
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-brand-purple" /> Biometric Access
                </Link>
              </li>
              <li>
                <Link href="/webdev" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-brand-purple" /> Web Development
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-brand-purple" /> Intruder Alarms
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-brand-purple" /> Video Door Phones
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-brand-cyan text-sm font-bold uppercase tracking-widest mb-6">Company</h4>
            <ul className="space-y-3 text-base text-slate-300">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/products" className="hover:text-white transition-colors">Products</Link></li>
              <li><Link href="/info/policies/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/info/policies/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          <div className="col-span-2 md:col-span-2 bg-white/[0.02] border border-white/5 rounded-2xl p-6 md:p-7 relative overflow-hidden group hover:border-brand-cyan/30 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe className="h-16 w-16 text-brand-cyan" />
            </div>

            <h4 className="text-white font-bold font-tech text-xl mb-4">Reach Us</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-base">
              <div>
                <span className="block text-xs text-slate-500 uppercase mb-1">Location</span>
                <address className="text-slate-300 not-italic leading-relaxed mb-1">{address}</address>
                <a
                  href="https://maps.app.goo.gl/HZDjt3zoB1Rcrjqp8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-cyan hover:underline"
                >
                  View on Google Maps
                </a>
              </div>
              <div>
                <span className="block text-xs text-slate-500 uppercase mb-1">Contact</span>
                <p className="text-brand-cyan hover:text-white transition-colors">
                  <a href={`tel:${supportPhone.replace(/\s+/g,'')}`}>{supportPhone}</a>
                </p>
                <p className="text-brand-cyan hover:text-white transition-colors">
                  <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-white/5 text-sm text-slate-400">
          <div className="flex flex-col items-center gap-1.5 md:flex-row md:items-center md:gap-6 text-center md:text-left">
            <p>© 2025 TecBunny. All rights reserved. Built with ❤️ and innovation.</p>
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-4">
              <p className="font-mono text-xs sm:text-sm">CIN: U80200GA2025PTC017488</p>
              <span className="hidden sm:inline text-white/10">|</span>
              <p className="font-mono text-xs sm:text-sm">GSTIN: {companyInfo.gstin || '30AAMCT1608G1ZO'}</p>
            </div>
          </div>

          {activeSocialPlatforms.length > 0 && (
            <div className="flex gap-6">
              {activeSocialPlatforms.map(({ key, icon: Icon, label }) => (
                <a
                  key={key}
                  href={socialLinks[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-cyan transition-colors"
                  onClick={() => handleSocialClick(label)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}