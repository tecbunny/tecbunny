import Link from 'next/link';
import type { Metadata } from 'next';

import { ShieldCheck, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/customised-setups/RefreshButton';
import { QuoteCTA } from '@/components/customised-setups/QuoteCTA';
import { QuotationStatusLookup } from '@/components/customised-setups/QuotationStatusLookup';
import CustomSetupFlow from '@/components/customised-setups/ClientCustomSetupFlow';
import { DEFAULT_CUSTOM_SETUP_TEMPLATE_SLUG } from '@/lib/custom-setup.constants';
import { getCustomSetupBlueprintSummary } from '@/lib/custom-setup-service';

import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Custom Surveillance Setups & Estimator | TecBunny',
  description: 'Design and estimate custom CCTV deployment, smart home automation, and networking bundles tailored for your premises in Goa.',
  path: '/customised-setups',
  keywords: ['surveillance setups', 'CCTV estimator', 'home security configurations', 'Goa security systems'],
});

// export const dynamic = 'force-dynamic';
export const revalidate = 0; // Force no caching

export default async function CustomisedSetupsPage({
  searchParams,
}: {
  searchParams: Promise<{ refresh?: string }>;
}) {
  const { refresh } = await searchParams;
  const refreshKey = refresh ?? 'default';
  let blueprint = null;
  try {
    blueprint = await getCustomSetupBlueprintSummary(DEFAULT_CUSTOM_SETUP_TEMPLATE_SLUG);
    // Debug log for blueprint fetch - can be removed in production

    //   success: !!blueprint,
    //   systemCount: blueprint?.systems?.length || 0,
    //   slug: DEFAULT_CUSTOM_SETUP_TEMPLATE_SLUG,
    //   timestamp: new Date().toISOString(),
    //   refreshParam: searchParams.refresh || 'none',
    //   samplePricing: blueprint?.systems?.[0]?.components?.[0]?.options?.[0] ? {
    //     label: blueprint.systems[0].components[0].options[0].label,
    //     unitPrice: blueprint.systems[0].components[0].options[0].unitPrice,
    //     metadata: blueprint.systems[0].components[0].options[0].metadata
    //   } : null
    // });
  } catch (error) {
    // Log error for debugging - consider using proper logging service in production
    console.error('Failed to fetch blueprint for public page:', error);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative pt-28 pb-12 overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-noise opacity-10"></div>
        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" /> Custom Setup Configurator
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold text-foreground">
            Design Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Ecosystem</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-3xl mx-auto font-tech">
            Build a bespoke security and IT solution tailored to your exact floor plan. Select your premises, define your needs, and let our system draft a blueprint for you.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/contact">Request a site survey</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-border text-foreground hover:bg-muted">
              <Link href="mailto:solutions@tecbunny.com?subject=Customised%20Setup%20Enquiry">Email solutions desk</Link>
            </Button>
            <RefreshButton />
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <QuoteCTA />
          <QuotationStatusLookup />
        </div>
        <CustomSetupFlow key={refreshKey} blueprint={blueprint} variant="tech" />
      </section>

      <section className="border-t border-border bg-muted/20 py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-3xl font-semibold text-foreground">What happens after you share this estimate?</h2>
            <p className="text-muted-foreground">
              A TecBunny engineer validates cable runs, storage retention, and power plans before scheduling deployment.
              Expect a full bill of materials and implementation timeline within one business day.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-muted-foreground">
                <Wrench className="h-4 w-4" /> Certified on-site specialists
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4" /> Compliance-ready hardware choices
              </span>
            </div>
          </div>
          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="https://wa.me/919604136010" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
