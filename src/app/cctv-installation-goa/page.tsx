import type { Metadata } from 'next';

import LocalServiceLandingPage from '@/components/LocalServiceLandingPage';
import { createPageMetadata } from '../../lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CCTV Installation in Goa',
  description: 'TecBunny Solutions delivers CCTV site surveys, camera installation, cabling, storage configuration, and post-install support for homes and businesses in Goa.',
  keywords: ['cctv installation goa', 'security camera installation goa', 'cctv company goa', 'camera setup goa', 'cctv site survey goa'],
  path: '/cctv-installation-goa',
  image: '/brand.png',
});

export default function Page() {
  return (
    <LocalServiceLandingPage
      badge="Goa CCTV Installation"
      title="CCTV Installation in Goa for Homes, Offices, Hotels, and Schools"
      description="Plan, deploy, and secure your property with TecBunny CCTV installation services in Goa. We handle site surveys, camera layout planning, cabling, recorder setup, and post-install guidance for reliable monitoring."
      locationLabel="North Goa and surrounding Goa service areas"
      primaryCtaLabel="Request CCTV Site Survey"
      primaryCtaHref="/contact?subject=sales&service=cctv_installation_goa&intent=site_survey&message=I%20need%20a%20CCTV%20site%20survey%20in%20Goa.%20Please%20share%20available%20slots%20and%20a%20quote."
      secondaryCtaLabel="Configure CCTV Quote"
      secondaryCtaHref="/customised-setups"
      heroHighlights={['Fresh deployments', 'Recorder and storage setup', 'Local survey support']}
      audience={['Homeowners', 'Retail shops', 'Hotels and villas', 'Schools and offices']}
      deliverables={[
        'Camera count and coverage planning matched to the site layout.',
        'Recorder, storage, and remote-viewing setup for day-to-day use.',
        'Cable path, power, and mounting recommendations before deployment.',
        'Clear quotation after scope confirmation and site validation.',
      ]}
      process={[
        'Share the property type, camera count estimate, and expected coverage areas.',
        'TecBunny confirms the survey scope and recommends a suitable installation path.',
        'You receive a quotation and rollout timeline after the site review.',
      ]}
      faqs={[
        {
          question: 'Do you handle both new installations and upgrades?',
          answer: 'Yes. TecBunny can install a fresh CCTV system or upgrade an existing one after checking cabling, recorder health, and camera compatibility.',
        },
        {
          question: 'Can you recommend camera placement during the survey?',
          answer: 'Yes. Survey discussions cover entrances, blind spots, storage retention, night visibility, and remote access requirements.',
        },
        {
          question: 'Do you support business and hotel properties?',
          answer: 'Yes. The installation workflow is suitable for homes, offices, hotels, schools, and multi-zone commercial sites.',
        },
        {
          question: 'How do I get the fastest quote?',
          answer: 'Use the site survey CTA and share your property type, rough camera count, and location so the team can qualify the request quickly.',
        },
      ]}
      iconName="cctv"
      eventPrefix="cctv_installation_goa"
    />
  );
}