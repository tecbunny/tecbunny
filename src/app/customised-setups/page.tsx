import Link from 'next/link';
import type { Metadata } from 'next';

import { ShieldCheck, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import CustomSetupFlow from '@/components/customised-setups/CustomSetupFlow';
import { RefreshButton } from '@/components/customised-setups/RefreshButton';
import { QuoteCTA } from '@/components/customised-setups/QuoteCTA';
import { DEFAULT_CUSTOM_SETUP_TEMPLATE_SLUG } from '@/lib/custom-setup.constants';
import { getCustomSetupBlueprintSummary } from '@/lib/custom-setup-service';

export const metadata: Metadata = {
  title: 'Customised Setups - TecBunny Store',
  description:
    'Build a CCTV deployment tailored to your site. Select DVR/NVR paths, camera counts, storage, and services to preview TecBunny pricing instantly.',
  openGraph: {
    title: 'Customised Setups | TecBunny',
    description: 'Configure TecBunny surveillance bundles with transparent MRP vs sale pricing.',
    type: 'website',
  },
};

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
    <main className="min-h-screen bg-[#030712] text-slate-200">
      <section className="relative pt-28 pb-12 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10"></div>
        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-cyan-300">
            <ShieldCheck className="h-4 w-4" /> Custom Setup Configurator
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold text-white">
            Design Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">Ecosystem</span>
          </h1>
          <p className="mt-4 text-slate-400 max-w-3xl mx-auto">
            Build a bespoke security and IT solution tailored to your exact floor plan. Select your premises, define your needs, and let our system draft a blueprint for you.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="bg-cyan-400 text-slate-900 hover:bg-white">
              <Link href="/contact">Request a site survey</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/10 text-slate-200 hover:bg-white/10">
              <Link href="mailto:solutions@tecbunny.com?subject=Customised%20Setup%20Enquiry">Email solutions desk</Link>
            </Button>
            <RefreshButton />
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto mb-6">
          <QuoteCTA />
        </div>
        <CustomSetupFlow key={refreshKey} blueprint={blueprint} variant="tech" />
      </section>

      <section className="border-t border-white/10 bg-[#050b14] py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-3xl font-semibold text-white">What happens after you share this estimate?</h2>
            <p className="text-slate-300">
              A TecBunny engineer validates cable runs, storage retention, and power plans before scheduling deployment.
              Expect a full bill of materials and implementation timeline within one business day.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-slate-300">
                <Wrench className="h-4 w-4" /> Certified on-site specialists
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-slate-300">
                <ShieldCheck className="h-4 w-4" /> Compliance-ready hardware choices
              </span>
            </div>
          </div>
          <Button asChild size="lg" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100">
            <Link href="https://wa.me/919604136010" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
