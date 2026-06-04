import type { Metadata } from 'next';

import PoliciesManagement from '@/components/admin/PoliciesManagement';

export const metadata: Metadata = {
  title: 'Policies Management - Admin Panel | TecBunny Solutions',
  description: 'Manage legal documents, privacy policy, terms of service, and other policies.',
  keywords: 'policies management, privacy policy, terms of service, legal documents, admin panel',
  robots: 'noindex, nofollow' // Admin only content
};

export default function Page() {
  return <PoliciesManagement />;
}
