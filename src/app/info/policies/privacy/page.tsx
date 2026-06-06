import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';
import { getPolicyContent } from '@/lib/settings';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Read how TecBunny Solutions collects, stores, and protects your personal information.',
};

export default async function PrivacyPolicyPage() {
  const content = await getPolicyContent('privacy_policy', 'Privacy Policy');
  return <PolicyPage pageKey="privacy_policy" defaultTitle="Privacy Policy" initialContent={content} />;
}
