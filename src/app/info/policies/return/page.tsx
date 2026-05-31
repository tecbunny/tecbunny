import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';

export const metadata: Metadata = {
  title: 'Return & Exchange Policy',
  description: 'Read TecBunny Solutions return and exchange terms for eligible products and service scenarios.',
};

export default function ReturnPolicyPage() {
  return <PolicyPage pageKey="return_policy" defaultTitle="Return & Exchange Policy" />;
}
