import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';
import { getPolicyContent } from '@/lib/settings';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Return & Exchange Policy',
  description: 'Read TecBunny Solutions return and exchange terms for eligible products and service scenarios.',
};

export default async function ReturnPolicyPage() {
  const content = await getPolicyContent('return_policy', 'Return & Exchange Policy');
  return <PolicyPage pageKey="return_policy" defaultTitle="Return & Exchange Policy" initialContent={content} />;
}
