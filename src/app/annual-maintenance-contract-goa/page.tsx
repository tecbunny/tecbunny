import type { Metadata } from 'next';

import LocalServiceLandingPage from '@/components/LocalServiceLandingPage';
import { createPageMetadata } from '../../lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Annual Maintenance Contract in Goa',
  description: 'Get CCTV and computer AMC services in Goa with preventive maintenance, diagnostics, and priority support from TecBunny Solutions.',
  keywords: ['annual maintenance contract goa', 'amc services goa', 'cctv amc goa', 'computer amc goa', 'it maintenance goa'],
  path: '/annual-maintenance-contract-goa',
  image: '/brand.png',
});

export default function Page() {
  return (
    <LocalServiceLandingPage
      badge="Goa AMC Services"
      title="Annual Maintenance Contract Services in Goa for CCTV and IT Systems"
      description="Reduce downtime with TecBunny annual maintenance contract services in Goa. We support preventive maintenance, system health reviews, and break-fix response for CCTV and computer infrastructure."
      locationLabel="Goa support coverage for residential and business AMC"
      primaryCtaLabel="Request AMC Quote"
      primaryCtaHref="/contact?subject=sales&service=annual_maintenance_contract_goa&intent=amc_quote&message=I%20need%20an%20AMC%20quote%20in%20Goa.%20Please%20share%20plan%20options%20for%20my%20setup."
      secondaryCtaLabel="Review AMC Terms"
      secondaryCtaHref="/services#amc-terms"
      heroHighlights={['Preventive maintenance', 'Priority support', 'CCTV and computer coverage']}
      audience={['Homes with surveillance systems', 'Offices with multiple devices', 'Retail and hospitality sites', 'Schools and managed facilities']}
      deliverables={[
        'Scheduled maintenance visits for cleaning, diagnostics, and system review.',
        'Priority support for breakdowns and ongoing performance issues.',
        'Coverage planning aligned to your installed CCTV or computer inventory.',
        'Clear scope, exclusions, and support windows before AMC activation.',
      ]}
      process={[
        'Share the number of systems, devices, or locations that need coverage.',
        'TecBunny reviews the installed base and recommends a practical AMC scope.',
        'You receive the AMC quote, response expectations, and activation guidance.',
      ]}
      faqs={[
        {
          question: 'What systems can be covered under an AMC?',
          answer: 'AMC planning can cover CCTV equipment, recorders, and computer systems depending on the installed base and support scope.',
        },
        {
          question: 'Is AMC only for businesses?',
          answer: 'No. Homes, villas, and small setups can also use AMC support when ongoing maintenance matters.',
        },
        {
          question: 'Do AMC plans include hardware replacement?',
          answer: 'Coverage depends on the selected plan and contract scope. TecBunny confirms inclusions, exclusions, and claim caps before activation.',
        },
        {
          question: 'How should I request an AMC quote?',
          answer: 'Include the number of cameras, recorders, PCs, and the site type so the team can suggest the right coverage level.',
        },
      ]}
      iconName="shield"
      eventPrefix="annual_maintenance_contract_goa"
    />
  );
}