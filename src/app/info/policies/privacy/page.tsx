
import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';
import { getPageContentServer } from '@/lib/page-content';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Read how TecBunny Solutions collects, stores, and protects your personal information.',
};

export default async function PrivacyPolicyPage() {
  const content = await getPageContentServer('privacy_policy');
  return <PolicyPage pageKey="privacy_policy" defaultTitle="Privacy Policy" initialContent={content} />;
}
