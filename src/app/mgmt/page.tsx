import { redirect } from 'next/navigation';

import { createServerClient } from '@/lib/supabase';

import DashboardClient from './dashboard-client';

export default async function ManagementPage() {
  const supabase = await createServerClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/staff/login');
  }

  return <DashboardClient />;
}
