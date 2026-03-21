import UserAnalyticsClient from './UserAnalyticsClient';

export async function generateStaticParams() {
  return [{ id: '1' }];
}

export default function Page() {
  return <UserAnalyticsClient />;
}
