import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';
import { getPageContentServer } from '@/lib/page-content';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'Review TecBunny Solutions cancellation handling and refund eligibility conditions.',
};

export default async function RefundCancellationPolicyPage() {
  const content = await getPageContentServer('refund_cancellation_policy');
  return <PolicyPage pageKey="refund_cancellation_policy" defaultTitle="Refund & Cancellation Policy" initialContent={content} />;
}
