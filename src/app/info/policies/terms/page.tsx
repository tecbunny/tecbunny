
import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';
import { getPageContentServer } from '@/lib/page-content';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Review the terms and conditions for using TecBunny Solutions services and storefront features.',
};

export default async function TermsAndConditionsPage() {
  const content = await getPageContentServer('terms_of_service');
  return <PolicyPage pageKey="terms_of_service" defaultTitle="Terms of Service" initialContent={content} />;
}
