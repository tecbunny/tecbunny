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
    <footer className="relative bg-[#0F172A] text-slate-400 border-t border-slate-800 py-16 sm:py-24 font-sans">
      <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Column 1: Services */}
          <div>
            <h4 className="text-white text-base font-tech font-black uppercase tracking-[0.2em] mb-6">Services</h4>
            <ul className="space-y-3.5 text-base font-medium">
              <li>
                <Link href="/services/smart-infrastructure" className="hover:text-primary transition-all hover:translate-x-1 inline-block text-slate-300">
                  Smart Infrastructure
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-primary transition-all hover:translate-x-1 inline-block text-slate-300">
                  Biometric Access
                </Link>
              </li>
              <li>
                <Link href="/webdev" className="hover:text-primary transition-all hover:translate-x-1 inline-block text-slate-300">
                  Web Development
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-primary transition-all hover:translate-x-1 inline-block text-slate-300">
                  Intruder Alarms
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-primary transition-all hover:translate-x-1 inline-block text-slate-300">
                  Video Door Phones
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Company */}
          <div>
            <h4 className="text-white text-base font-tech font-black uppercase tracking-[0.2em] mb-6">Company</h4>
            <ul className="space-y-3.5 text-base font-medium">
              <li><Link href="/about" className="hover:text-primary transition-all hover:translate-x-1 inline-block text-slate-300">About Us</Link></li>
              <li><Link href="/products" className="hover:text-primary transition-all hover:translate-x-1 inline-block text-slate-300">Products</Link></li>
              <li><Link href="/info/policies/privacy" className="hover:text-primary transition-all hover:translate-x-1 inline-block text-slate-300">Privacy Policy</Link></li>
              <li><Link href="/info/policies/terms" className="hover:text-primary transition-all hover:translate-x-1 inline-block text-slate-300">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Column 3: Contact Details */}
          <div className="text-base font-medium">
            <h4 className="text-white text-base font-tech font-black uppercase tracking-[0.2em] mb-6">Contact</h4>
            <address className="leading-relaxed text-slate-300 not-italic">{address}</address>
            <div className="mt-4 space-y-2">
              <p className="text-blue-500 hover:text-blue-400 transition-colors font-tech font-bold text-base">
                <a href={`tel:${supportPhone.replace(/\s+/g,'')}`}>{supportPhone}</a>
              </p>
              <p className="text-blue-500 hover:text-blue-400 transition-colors font-tech font-bold text-base">
                <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              </p>
            </div>
          </div>

          {/* Column 4: Updates Form */}
          <div>
            <h4 className="text-white text-base font-tech font-black uppercase tracking-[0.2em] mb-6">Updates</h4>
            <p className="text-base text-slate-300 mb-4 leading-relaxed font-medium">Subscribe to security advisories and tech updates.</p>
            <form className="flex gap-2 max-w-sm" onSubmit={handleSubscribe}>
              <input
                type="email"
                placeholder="Secure email..."
                value={subscribeEmail}
                onChange={(event) => {
                  setSubscribeEmail(event.target.value);
                  if (subscribeStatus !== 'idle') {
                    setSubscribeStatus('idle');
                    setSubscribeMessage(null);
                  }
                }}
                className="bg-[#1E293B] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 w-full placeholder-slate-500 transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={subscribeStatus === 'loading'}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-40"
              >
                {subscribeStatus === 'loading' ? '...' : 'Subscribe'}
              </button>
            </form>
            {subscribeMessage && (
              <p className={`mt-3 text-xs font-bold tracking-wide ${subscribeStatus === 'success' ? 'text-emerald-500' : 'text-rose-500'}`} role="status">
                {subscribeMessage}
              </p>
            )}
          </div>
        </div>

        {/* Footer Bottom (Copyright, CIN, GSTIN, and Socials) */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-10 border-t border-slate-800 text-sm tracking-wide text-slate-400 font-medium">
          <div className="flex flex-col items-center gap-2 md:flex-row md:items-center md:gap-6 text-center md:text-left">
            <p>© 2026 TecBunny Solutions. All rights reserved.</p>
            <div className="flex items-center gap-3 font-mono">
              <span>CIN: U80200GA2025PTC017488</span>
              <span className="hidden md:inline">|</span>
              <span>GSTIN: {companyInfo.gstin || '30AAMCT1608G1ZO'}</span>
            </div>
          </div>

          {activeSocialPlatforms.length > 0 && (
            <div className="flex gap-5">
              {activeSocialPlatforms.map(({ key, icon: Icon, label }) => (
                <a
                  key={key}
                  href={socialLinks[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-blue-600 hover:text-white hover:scale-110 transition-all shadow-sm hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]"
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