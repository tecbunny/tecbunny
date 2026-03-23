
import type { Metadata } from 'next';

import PolicyPage from '../../../../components/policy-page';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Review the terms and conditions for using TecBunny Solutions services and storefront features.',
};

export default function TermsAndConditionsPage() {
  return <PolicyPage pageKey="terms_of_service" defaultTitle="Terms of Service" />;
}
