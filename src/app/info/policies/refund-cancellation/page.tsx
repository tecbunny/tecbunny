import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'Review TecBunny Solutions cancellation handling and refund eligibility conditions.',
};

export default function RefundCancellationPolicyPage() {
  return <PolicyPage pageKey="refund_cancellation_policy" defaultTitle="Refund & Cancellation Policy" />;
}
