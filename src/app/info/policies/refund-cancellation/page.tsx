import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';
import { getPolicyContent } from '@/lib/settings';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'Review TecBunny Solutions cancellation handling and refund eligibility conditions.',
};

export default async function RefundCancellationPolicyPage() {
  const content = await getPolicyContent('refund_cancellation_policy', 'Refund & Cancellation Policy');
  return <PolicyPage pageKey="refund_cancellation_policy" defaultTitle="Refund & Cancellation Policy" initialContent={content} />;
}
