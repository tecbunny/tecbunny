'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  BadgeIndianRupee,
  Bot,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  Globe,
  Megaphone,
  Package,
  Palette,
  Save,
  Settings,
  Share2,
  SlidersHorizontal,
  Users,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

type SettingField = {
  key: string;
  label: string;
  description: string;
  type?: 'text' | 'textarea' | 'number';
};

type SettingSection = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  fields: SettingField[];
};

const sections: SettingSection[] = [
  {
    id: 'users',
    title: 'User Management',
    description: 'Root controls for customer, staff, role, and access workflows.',
    icon: Users,
    href: '/mgmt/admin/users',
    fields: [
      { key: 'user_default_role', label: 'Default role', description: 'Role assigned to newly created users.' },
      { key: 'user_onboarding_mode', label: 'Onboarding mode', description: 'Manual, assisted, or open customer onboarding.' },
    ],
  },
  {
    id: 'products',
    title: 'Product Management',
    description: 'Catalog defaults, stock rules, and product display behavior.',
    icon: Package,
    href: '/mgmt/admin/products',
    fields: [
      { key: 'partnerBrands', label: 'Partner brands', description: 'Comma-separated brand list used across product pages.', type: 'textarea' },
      { key: 'product_low_stock_threshold', label: 'Low stock threshold', description: 'Default threshold for low-stock warnings.', type: 'number' },
    ],
  },
  {
    id: 'payment',
    title: 'Payment Management',
    description: 'Payment gateway routing and operational payment settings.',
    icon: CreditCard,
    href: '/superadmin/mgmt/payment-settings',
    fields: [
      { key: 'payu_enabled', label: 'PayU enabled', description: 'Use true or false to control PayU checkout availability.' },
      { key: 'payu_environment', label: 'PayU environment', description: 'test or production.' },
    ],
  },
  {
    id: 'website',
    title: 'Website Management',
    description: 'Public site identity, homepage metadata, and contact defaults.',
    icon: Globe,
    href: '/mgmt/admin/homepage-settings',
    fields: [
      { key: 'siteName', label: 'Site name', description: 'Browser and metadata site name.' },
      { key: 'siteDescription', label: 'Site description', description: 'Default public SEO description.', type: 'textarea' },
      { key: 'phone', label: 'Support phone', description: 'Primary customer-facing support phone.' },
      { key: 'support_email', label: 'Support email', description: 'Primary customer-facing support email.' },
    ],
  },
  {
    id: 'brand',
    title: 'Brand Management',
    description: 'Logo, favicon, theme colors, and brand presentation.',
    icon: Palette,
    href: '/mgmt/admin/settings',
    fields: [
      { key: 'site_branding', label: 'Brand name', description: 'Short brand label used in the UI.' },
      { key: 'logoUrl', label: 'Logo URL', description: 'Public logo asset path or URL.' },
      { key: 'faviconUrl', label: 'Favicon URL', description: 'Public favicon asset path or URL.' },
      { key: 'tagline', label: 'Tagline', description: 'Short brand tagline shown in public surfaces.' },
    ],
  },
  {
    id: 'policies',
    title: 'Policies Management',
    description: 'Legal policy publishing controls and public policy defaults.',
    icon: FileText,
    href: '/mgmt/admin/policies',
    fields: [
      { key: 'privacy_policy_summary', label: 'Privacy policy summary', description: 'Short internal summary for privacy policy status.', type: 'textarea' },
      { key: 'returns_policy_summary', label: 'Return policy summary', description: 'Short internal summary for return/refund policy status.', type: 'textarea' },
    ],
  },
  {
    id: 'ai',
    title: 'AI Configurations',
    description: 'Prompt overrides, model behavior, and AI tooling defaults.',
    icon: Bot,
    href: '/superadmin/mgmt/ai-config',
    fields: [
      { key: 'ai_default_model', label: 'Default AI model', description: 'Model identifier used when no specific model is selected.' },
      { key: 'ai_temperature', label: 'Temperature', description: 'Default generation temperature.', type: 'number' },
    ],
  },
  {
    id: 'social',
    title: 'Social Media Management',
    description: 'Public social links and social tracking identifiers.',
    icon: Share2,
    href: '/mgmt/admin/social-media',
    fields: [
      { key: 'facebookUrl', label: 'Facebook URL', description: 'Public Facebook profile/page link.' },
      { key: 'instagramUrl', label: 'Instagram URL', description: 'Public Instagram profile link.' },
      { key: 'twitterUrl', label: 'X URL', description: 'Public X/Twitter profile link.' },
      { key: 'linkedinUrl', label: 'LinkedIn URL', description: 'Public LinkedIn page link.' },
      { key: 'youtubeUrl', label: 'YouTube URL', description: 'Public YouTube channel link.' },
      { key: 'facebook_pixel_id', label: 'Facebook pixel ID', description: 'Meta pixel identifier for tracking.' },
    ],
  },
  {
    id: 'offers',
    title: 'Offers Management',
    description: 'Offer, coupon, and discount display controls.',
    icon: Gift,
    href: '/mgmt/admin/offers',
    fields: [
      { key: 'offers_enabled', label: 'Offers enabled', description: 'Use true or false to control offer display.' },
      { key: 'default_coupon_prefix', label: 'Coupon prefix', description: 'Prefix used for generated coupon codes.' },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing Management',
    description: 'Campaign, newsletter, WhatsApp, and remarketing controls.',
    icon: Megaphone,
    href: '/mgmt/admin/analytics',
    fields: [
      { key: 'whatsapp_template_string', label: 'WhatsApp link', description: 'Customer-facing WhatsApp quick contact link.' },
      { key: 'marketing_newsletter_enabled', label: 'Newsletter enabled', description: 'Use true or false for newsletter capture.' },
    ],
  },
  {
    id: 'company',
    title: 'Company Management',
    description: 'Business profile, registered address, and statutory identity.',
    icon: Building2,
    fields: [
      { key: 'company_name', label: 'Company name', description: 'Registered company or trade name.' },
      { key: 'company_address', label: 'Registered address', description: 'Full registered business address.', type: 'textarea' },
      { key: 'company_gstin', label: 'GSTIN', description: 'Registered GST identification number.' },
      { key: 'company_pan', label: 'PAN', description: 'Registered PAN number.' },
    ],
  },
  {
    id: 'tax',
    title: 'Tax Management',
    description: 'GST defaults, HSN lookup fallback, and tax behavior.',
    icon: BadgeIndianRupee,
    fields: [
      { key: 'default_gst_rate', label: 'Default GST rate', description: 'Fallback GST percentage, for example 18.00.', type: 'number' },
      { key: 'tax_invoice_prefix', label: 'Tax invoice prefix', description: 'Prefix used for invoice numbering.' },
    ],
  },
  {
    id: 'reports',
    title: 'All Reports',
    description: 'Full, manager-wise, and sales-person-wise reporting controls.',
    icon: ClipboardList,
    href: '/mgmt/admin/analytics',
    fields: [
      { key: 'reports_default_range_days', label: 'Default range days', description: 'Default reporting lookback window.', type: 'number' },
      { key: 'reports_export_enabled', label: 'Exports enabled', description: 'Use true or false to allow report downloads.' },
    ],
  },
  {
    id: 'custom-setups',
    title: 'Custom Setup Management',
    description: 'Custom setup pricing, quote rules, and service flow defaults.',
    icon: Wrench,
    href: '/mgmt/admin/custom-setups',
    fields: [
      { key: 'custom_setup_discount_percent', label: 'Setup discount percent', description: 'Default discount for custom setup pricing.', type: 'number' },
      { key: 'custom_setup_quote_valid_days', label: 'Quote validity days', description: 'Default validity window for custom setup quotes.', type: 'number' },
    ],
  },
];

const sectionGroups = [
  { id: 'core', label: 'Core', items: sections.slice(0, 5) },
  { id: 'content', label: 'Content', items: sections.slice(5, 10) },
  { id: 'company', label: 'Company', items: sections.slice(10) },
];

type SettingsMap = Record<string, string>;

export default function SuperadminSettingsPage() {
  const [values, setValues] = React.useState<SettingsMap>({});
  const [loading, setLoading] = React.useState(true);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [activeGroup, setActiveGroup] = React.useState('core');
  const { toast } = useToast();

  const allFields = React.useMemo(() => sections.flatMap((section) => section.fields), []);

  React.useEffect(() => {
    const requestedSection = new URLSearchParams(window.location.search).get('section');
    const group = sectionGroups.find((candidate) =>
      candidate.items.some((section) => section.id === requestedSection)
    );
    setActiveGroup(group?.id ?? 'core');
  }, []);

  React.useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const keys = allFields.map((field) => field.key).join(',');
        const response = await fetch(`/api/settings?keys=${encodeURIComponent(keys)}`);
        if (!response.ok) {
          throw new Error('Could not load settings');
        }
        const data = await response.json();
        const nextValues: SettingsMap = {};
        allFields.forEach((field) => {
          const raw = data?.[field.key];
          nextValues[field.key] = raw === undefined || raw === null ? '' : String(raw);
        });
        setValues(nextValues);
      } catch (error) {
        toast({
          title: 'Settings unavailable',
          description: error instanceof Error ? error.message : 'Could not load settings.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [allFields, toast]);

  const updateValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const saveField = async (field: SettingField) => {
    setSavingKey(field.key);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: field.key,
          value: values[field.key] ?? '',
          description: field.description,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Could not save ${field.label}`);
      }

      toast({
        title: 'Setting saved',
        description: `${field.label} updated successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not save setting.',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rose-300">
          <Settings className="h-4 w-4" />
          Root Settings
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Superadmin Settings</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Central control panel for user, product, payment, website, brand, policy, AI, social, offer, marketing, company, tax, report, and custom setup configuration.
            </p>
          </div>
          <Link
            href="/superadmin/mgmt/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-medium text-slate-200 transition hover:border-rose-400/40 hover:bg-white/5"
          >
            Control Center
          </Link>
        </div>
      </header>

      <Tabs value={activeGroup} onValueChange={setActiveGroup} className="space-y-5">
        <TabsList className="grid w-full max-w-xl grid-cols-3 bg-slate-950/80">
          {sectionGroups.map((group) => (
            <TabsTrigger key={group.id} value={group.id}>
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {sectionGroups.map((group) => (
          <TabsContent key={group.id} value={group.id} className="space-y-4">
            {group.items.map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.id} className="rounded-lg border border-white/10 bg-slate-950/70 p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10">
                        <Icon className="h-5 w-5 text-rose-300" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                        <p className="mt-1 text-sm text-slate-400">{section.description}</p>
                      </div>
                    </div>
                    {section.href && (
                      <Link
                        href={section.href}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 px-3 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
                      >
                        Open Module
                      </Link>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {section.fields.map((field) => (
                      <div key={field.key} className="rounded-md border border-white/10 bg-slate-900/50 p-4">
                        <div className="mb-3 space-y-1">
                          <Label htmlFor={field.key} className="text-sm font-semibold text-slate-100">
                            {field.label}
                          </Label>
                          <p className="text-xs leading-relaxed text-slate-500">{field.description}</p>
                        </div>
                        {field.type === 'textarea' ? (
                          <Textarea
                            id={field.key}
                            value={values[field.key] ?? ''}
                            onChange={(event) => updateValue(field.key, event.target.value)}
                            disabled={loading}
                            className="min-h-24 border-white/10 bg-slate-950/80 text-slate-100"
                          />
                        ) : (
                          <Input
                            id={field.key}
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={values[field.key] ?? ''}
                            onChange={(event) => updateValue(field.key, event.target.value)}
                            disabled={loading}
                            className="border-white/10 bg-slate-950/80 text-slate-100"
                          />
                        )}
                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveField(field)}
                            disabled={loading || savingKey === field.key}
                            className="gap-2 bg-rose-600 text-white hover:bg-rose-500"
                          >
                            <Save className="h-4 w-4" />
                            {savingKey === field.key ? 'Saving' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>

      <section className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4">
        <div className="flex gap-3">
          <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
          <div>
            <h2 className="text-sm font-semibold text-cyan-100">Operational Note</h2>
            <p className="mt-1 text-sm text-cyan-100/70">
              These values are stored through the existing settings API. Dedicated modules remain available for deeper workflows such as products, offers, policies, payment gateways, AI prompts, and reports.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
