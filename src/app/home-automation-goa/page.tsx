import type { Metadata } from 'next';

import LocalServiceLandingPage from '@/components/LocalServiceLandingPage';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Home Automation in Goa',
  description: 'TecBunny Solutions designs smart home and connected-space automation in Goa for homes, villas, offices, and hospitality sites.',
  keywords: ['home automation goa', 'smart home solutions goa', 'home automation company goa', 'automation setup goa', 'smart office goa'],
  path: '/home-automation-goa',
  image: '/brand.png',
});

export default function Page() {
  return (
    <LocalServiceLandingPage
      badge="Goa Home Automation"
      title="Home Automation in Goa for Smarter Homes, Offices, and Hospitality Spaces"
      description="TecBunny builds practical home automation systems in Goa for lighting, access, monitoring, and day-to-day control. The focus is reliable automation that fits the property, not generic gadget bundles."
      locationLabel="Goa deployment support for residential and commercial automation"
      primaryCtaLabel="Book Automation Consultation"
      primaryCtaHref="/contact?subject=sales&service=home_automation_goa&intent=automation_consultation&message=I%20want%20a%20home%20automation%20consultation%20in%20Goa.%20Please%20help%20me%20plan%20the%20right%20setup."
      secondaryCtaLabel="Explore Smart Security"
      secondaryCtaHref="/innovation"
      heroHighlights={['Lighting and access workflows', 'Site-specific recommendations', 'Scalable smart controls']}
      audience={['Homeowners and villa operators', 'Boutique hotels', 'Managed apartments', 'Office and front-desk teams']}
      deliverables={[
        'Requirement discovery for lighting, access, monitoring, and convenience goals.',
        'Practical recommendations based on your property layout and operating pattern.',
        'Scalable automation design that can grow with future devices or spaces.',
        'A clear implementation path before installation or configuration begins.',
      ]}
      process={[
        'Share what you want to control or automate in the property.',
        'TecBunny reviews use cases, device fit, and operational priorities.',
        'You receive a consultation outcome with scope guidance and next-step recommendations.',
      ]}
      faqs={[
        {
          question: 'What kind of automation can TecBunny help with?',
          answer: 'Typical projects include lighting control, access workflows, integrated monitoring, and other practical automation needs for homes and business spaces.',
        },
        {
          question: 'Can automation be added gradually?',
          answer: 'Yes. Systems can be scoped in phases so the first setup covers core needs and later stages expand the experience.',
        },
        {
          question: 'Is this only for new properties?',
          answer: 'No. Existing homes, villas, and offices can also be reviewed for retrofit-friendly automation options.',
        },
        {
          question: 'What should I mention in my consultation request?',
          answer: 'Include the property type, the controls you want, and whether this is a fresh build or retrofit so the consultation starts with the right constraints.',
        },
      ]}
      iconName="wifi"
      eventPrefix="home_automation_goa"
    />
  );
}