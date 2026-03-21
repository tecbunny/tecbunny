import { Metadata } from 'next';

import SuperfoneIntegrationPage from '../../../../components/admin/superfone-integration';

export const metadata: Metadata = {
  title: 'Superfone Integration - TecBunny Store',
  description: 'Manage Superfone enterprise communication features',
};

export default function SuperfoneIntegrationRoute() {
  return <SuperfoneIntegrationPage />;
}
