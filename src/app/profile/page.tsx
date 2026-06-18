'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import UserProfile from '@/components/profile/UserProfile';
import { useAuth } from '@/lib/hooks';
import { logger } from '@/lib/logger';

export default function ProfilePage() {
  const { supabase, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<SupabaseUser | null>(null);
  const [profile, setProfile] = React.useState<any>(null);
  const [salesAgentData, setSalesAgentData] = React.useState<any>(null);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [serviceTickets, setServiceTickets] = React.useState<any[]>([]);
  const [quotes, setQuotes] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const { data: { user: supaUser } } = await supabase.auth.getUser();
        if (!supaUser) {
          router.replace('/auth/signin');
          return;
        }

        if (cancelled) return;
        setUser(supaUser);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', supaUser.id)
          .maybeSingle();

        const { data: salesAgent } = await supabase
          .from('sales_agents')
          .select('*')
          .eq('user_id', supaUser.id)
          .maybeSingle();

        const { data: recentOrders } = await supabase
          .from('orders')
          .select('id, status, total, total_amount, created_at, type')
          .eq('customer_id', supaUser.id)
          .order('created_at', { ascending: false })
          .limit(3);

        const { data: recentTickets } = await supabase
          .from('service_tickets')
          .select('id, issue_description, status, priority, created_at')
          .eq('customer_id', supaUser.id)
          .order('created_at', { ascending: false })
          .limit(5);

        const { data: quoteData } = await supabase
          .from('quotes')
          .select('*')
          .eq('user_id', supaUser.id)
          .order('created_at', { ascending: false });

        const fallbackProfile = profileData ?? {
          id: supaUser.id,
          name: supaUser.user_metadata?.name ?? supaUser.email?.split('@')[0] ?? 'User',
          email: supaUser.email,
          mobile: supaUser.user_metadata?.mobile ?? '',
          role: (supaUser.app_metadata?.role as string) ?? 'customer'
        };

        if (cancelled) return;
        setProfile(fallbackProfile);
        setSalesAgentData(salesAgent ?? null);
        setOrders(recentOrders ?? []);
        setServiceTickets(recentTickets ?? []);
        setQuotes(quoteData ?? []);
      } catch (error) {
        logger.error('profile.page_load_failed', { error });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    const timer = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        const supaUser = user || supabase.auth.getUser().then(({ data }) => data.user).catch(() => null);
        if (supaUser && !profile) {
          // Promise resolution or immediate fallback
          Promise.resolve(supaUser).then((resolvedUser) => {
            if (resolvedUser && !profile && !cancelled) {
              setUser(resolvedUser);
              setProfile({
                id: resolvedUser.id,
                name: resolvedUser.user_metadata?.name ?? resolvedUser.email?.split('@')[0] ?? 'User',
                email: resolvedUser.email,
                mobile: resolvedUser.user_metadata?.mobile ?? '',
                role: (resolvedUser.app_metadata?.role as string) ?? 'customer'
              });
            }
          });
        }
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authLoading, supabase, router, user, profile]);

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <UserProfile
      user={user}
      profile={profile}
      salesAgentData={salesAgentData}
      orders={orders}
      serviceTickets={serviceTickets}
      quotes={quotes}
    />
  );
}
