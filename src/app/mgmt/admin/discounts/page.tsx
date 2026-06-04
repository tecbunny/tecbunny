import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/management/admin/offers?tab=discounts');
}
