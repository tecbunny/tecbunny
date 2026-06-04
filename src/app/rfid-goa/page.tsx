import type { Metadata } from 'next';

import LocalServiceLandingPage from '@/components/LocalServiceLandingPage';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'RFID Lock System in Goa',
  description: 'TecBunny Solutions provides RFID lock systems and access control setup in Goa for hotels, offices, and secure managed spaces.',
  keywords: ['rfid lock system goa', 'access control system goa', 'smart lock installation goa', 'hotel lock system goa', 'biometric access goa'],
  path: '/rfid-lock-system-goa',
  image: '/brand.png',
});

export default function Page() {
  return (
    <LocalServiceLandingPage
      badge="Goa RFID Access Control"
      title="RFID Lock System and Access Control Setup in Goa"
      description="Control entry points more reliably with TecBunny RFID lock and access control solutions in Goa. We help hotels, offices, and managed properties plan the right access flow before deployment."
      locationLabel="Goa access-control support for hospitality and business sites"
      primaryCtaLabel="Request RFID Demo"
      primaryCtaHref="/contact?subject=sales&service=rfid_lock_system_goa&intent=rfid_demo&message=I%20want%20an%20RFID%20lock%20system%20demo%20or%20quote%20for%20my%20property%20in%20Goa."
      secondaryCtaLabel="Discuss Access Control"
      secondaryCtaHref="/contact?subject=sales&service=rfid_lock_system_goa&intent=access_control_quote&message=I%20need%20access%20control%20planning%20for%20my%20property%20in%20Goa."
      heroHighlights={['Hotel and office access flows', 'Demo-led qualification', 'Secure entry planning']}
      audience={['Hotels and guest properties', 'Office premises', 'Managed rentals', 'Restricted-access facilities']}
      deliverables={[
        'Access workflow planning for guests, staff, or team-based entry control.',
        'Recommendations for RFID and related access-control deployment based on site needs.',
        'Scope validation before hardware rollout or installation work begins.',
        'A quote or demo path based on property type and operational requirements.',
      ]}
      process={[
        'Share the property type, number of doors, and who needs access.',
        'TecBunny reviews the site needs and recommends a demo or direct quotation path.',
        'You receive the next-step plan for access control rollout and implementation.',
      ]}
      faqs={[
        {
          question: 'Who usually needs RFID lock systems?',
          answer: 'Hotels, offices, managed properties, and spaces with controlled access benefit most from a structured access-control plan.',
        },
        {
          question: 'Can I request a demo before committing?',
          answer: 'Yes. Use the RFID demo CTA so the team can qualify the requirement and suggest the right presentation or scope discussion.',
        },
        {
          question: 'Can this work alongside CCTV and monitoring?',
          answer: 'Yes. Access control planning often works best when considered alongside security monitoring and operational workflows.',
        },
        {
          question: 'What details help speed up the quote?',
          answer: 'Mention the number of entry points, property type, and whether the site is a hotel, office, or managed space.',
        },
      ]}
      iconName="lock"
      eventPrefix="rfid_lock_system_goa"
    />
  );
}