import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/mgmt/admin/offers?tab=discounts');
}
