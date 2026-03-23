
import type { Metadata } from 'next';

import PolicyPage from '../../../../components/policy-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Read how TecBunny Solutions collects, stores, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return <PolicyPage pageKey="privacy_policy" defaultTitle="Privacy Policy" />;
}
