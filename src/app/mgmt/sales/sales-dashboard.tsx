
'use client';

import * as React from 'react';

import { TrendingUp, Users, Package, ShoppingBag } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '../../../hooks/use-toast';
import { useAuth } from '@/lib/hooks';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderStatus } from '@/lib/types';
import { MarketingKitTerminal } from '@/components/sales/MarketingKitTerminal';

const COMPLETED_STATUSES: OrderStatus[] = ['Completed', 'Delivered', 'Payment Confirmed'];
const PENDING_DELIVERY_STATUSES: OrderStatus[] = ['Processing', 'Ready to Ship', 'Shipped'];
const PENDING_PICKUP_STATUS: OrderStatus = 'Ready for Pickup';

export default function SalesDashboard() {
    const { user } = useAuth();
    const { toast } = useToast();
    const supabase = React.useMemo(() => createClient(), []);
    const [stats, setStats] = React.useState({
        todayRevenue: 0,
        newCustomers: 0,
        pendingPickups: 0,
        pendingDeliveries: 0,
    });
    const [recentOrders, setRecentOrders] = React.useState<Order[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [referralCode, setReferralCode] = React.useState<string>('');

    const fetchStats = React.useCallback(async () => {
        setLoading(true);
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const [todayOrdersRes, newCustomersRes, pickupRes, deliveryRes, recentOrdersRes, agentRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('total,status,created_at')
                    .gte('created_at', startOfDay.toISOString())
                    .lte('created_at', endOfDay.toISOString())
                    .in('status', COMPLETED_STATUSES),
                supabase
                    .from('profiles')
                    .select('id', { count: 'exact', head: true })
                    .eq('role', 'customer')
                    .gte('created_at', startOfDay.toISOString())
                    .lte('created_at', endOfDay.toISOString()),
                supabase
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', PENDING_PICKUP_STATUS),
                supabase
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .in('status', PENDING_DELIVERY_STATUSES),
                supabase
                    .from('orders')
                    .select('id, customer_name, status, total, created_at')
                    .order('created_at', { ascending: false })
                    .limit(5),
                supabase
                    .from('sales_agents')
                    .select('referral_code')
                    .eq('user_id', user?.id)
                    .maybeSingle()
            ]);

            if (todayOrdersRes.error) throw todayOrdersRes.error;
            if (newCustomersRes.error) throw newCustomersRes.error;
            if (pickupRes.error) throw pickupRes.error;
            if (deliveryRes.error) throw deliveryRes.error;
            if (recentOrdersRes.error) throw recentOrdersRes.error;

            const todayRevenue = (todayOrdersRes.data || []).reduce((sum, order) => {
                const total = typeof order.total === 'number' ? order.total : 0;
                return sum + total;
            }, 0);

            setStats({
                todayRevenue,
                newCustomers: newCustomersRes.count ?? 0,
                pendingPickups: pickupRes.count ?? 0,
                pendingDeliveries: deliveryRes.count ?? 0,
            });
            setRecentOrders((recentOrdersRes.data as Order[]) || []);
            if (agentRes?.data?.referral_code) {
                setReferralCode(agentRes.data.referral_code);
            }
        } catch (error) {
            console.error('Failed to load dashboard metrics', error);
            toast({
                variant: 'destructive',
                title: 'Unable to load dashboard data',
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setLoading(false);
        }
    }, [supabase, toast]);

    React.useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-1">
            {/* Header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border pb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground tech-heading">Sales Overview</h1>
                    <p className="text-xs text-muted-foreground font-light mt-0.5 font-sans">
                        Real-time tracking of today's revenues, customer registrations, and order fulfillment status.
                    </p>
                </div>
                {/* User details badge */}
                <div className="flex items-center gap-2 mt-2 md:mt-0 animate-fade-in">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {user?.name || user?.email}
                    </span>
                    <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-primary">
                        {user?.role}
                    </span>
                </div>
            </div>

            {/* Metrics Bento Grid */}
            <div className="bento-grid sm:grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Today's Revenue */}
                <div className="bento-card p-6">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Revenue</span>
                        <div className="rounded-lg bg-muted p-2 text-muted-foreground border border-border">
                            <TrendingUp className="h-4 w-4 text-primary" />
                        </div>
                    </div>
                    <div className="mt-4">
                        {loading ? (
                            <Skeleton className="h-8 w-28 bg-muted" />
                        ) : (
                            <div>
                                <div className="text-2xl font-bold tracking-tight text-foreground tech-heading">
                                    ₹{stats.todayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <p className="mt-1 text-[10px] text-muted-foreground font-light">Processed today</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Card 2: New Customers */}
                <div className="bento-card p-6">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Customers</span>
                        <div className="rounded-lg bg-muted p-2 text-muted-foreground border border-border">
                            <Users className="h-4 w-4 text-primary" />
                        </div>
                    </div>
                    <div className="mt-4">
                        {loading ? (
                            <Skeleton className="h-8 w-16 bg-muted" />
                        ) : (
                            <div>
                                <div className="text-2xl font-bold tracking-tight text-foreground tech-heading">
                                    +{stats.newCustomers}
                                </div>
                                <p className="mt-1 text-[10px] text-muted-foreground font-light">New customer accounts today</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Card 3: Pending Pickups */}
                <div className="bento-card p-6">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Pickups</span>
                        <div className="rounded-lg bg-muted p-2 text-muted-foreground border border-border">
                            <ShoppingBag className="h-4 w-4 text-primary" />
                        </div>
                    </div>
                    <div className="mt-4">
                        {loading ? (
                            <Skeleton className="h-8 w-12 bg-muted" />
                        ) : (
                            <div>
                                <div className="text-2xl font-bold tracking-tight text-foreground tech-heading">
                                    {stats.pendingPickups}
                                </div>
                                <p className="mt-1 text-[10px] text-muted-foreground font-light">Ready for customer</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Card 4: Pending Deliveries */}
                {user?.role === 'manager' && (
                    <div className="bento-card p-6">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Deliveries</span>
                            <div className="rounded-lg bg-muted p-2 text-muted-foreground border border-border">
                                <Package className="h-4 w-4 text-primary" />
                            </div>
                        </div>
                        <div className="mt-4">
                            {loading ? (
                                <Skeleton className="h-8 w-12 bg-muted" />
                            ) : (
                                <div>
                                    <div className="text-2xl font-bold tracking-tight text-foreground tech-heading">
                                        {stats.pendingDeliveries}
                                    </div>
                                    <p className="mt-1 text-[10px] text-muted-foreground font-light">Needs processing</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Activity Table/Feed */}
            <div className="bento-card overflow-hidden">
                <div className="border-b border-border px-6 py-5 bg-muted/10">
                    <h2 className="text-base font-semibold text-foreground tech-heading">Recent Orders</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 font-light font-sans">Latest store, pickup, and delivery activity.</p>
                </div>
                
                <div className="p-6">
                    {loading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-14 w-full bg-muted/20" />
                            <Skeleton className="h-14 w-full bg-muted/20" />
                            <Skeleton className="h-14 w-full bg-muted/20" />
                        </div>
                    ) : recentOrders.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-xs text-muted-foreground font-light font-sans">No recent orders found for your view.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                        <th className="pb-3 font-medium">Customer Details</th>
                                        <th className="pb-3 font-medium">Order Time</th>
                                        <th className="pb-3 font-medium">Status</th>
                                        <th className="pb-3 font-medium text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {recentOrders.map((order) => {
                                        let badgeColorClass = "bg-muted text-muted-foreground border-border";
                                        const statusStr = order.status ? String(order.status) : '';
                                        
                                        if (COMPLETED_STATUSES.includes(order.status)) {
                                            badgeColorClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
                                        } else if (PENDING_DELIVERY_STATUSES.includes(order.status) || order.status === PENDING_PICKUP_STATUS) {
                                            badgeColorClass = "bg-primary/10 text-primary border-primary/20";
                                        } else if (['Cancelled', 'Rejected', 'Payment Failed'].includes(statusStr)) {
                                            badgeColorClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
                                        }
                                        
                                        return (
                                            <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="py-4">
                                                    <div className="text-xs font-semibold text-foreground">
                                                        {order.customer_name || 'Walk-in customer'}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                                        ID: {order.id.slice(0, 8).toUpperCase()}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-xs font-light text-muted-foreground">
                                                    {new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </td>
                                                <td className="py-4">
                                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${badgeColorClass}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-right text-xs font-semibold text-foreground font-mono">
                                                    ₹{Number(order.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Referral / Marketing Section */}
            {referralCode && (
                <div className="bento-card p-6">
                    <MarketingKitTerminal referralCode={referralCode} />
                </div>
            )}
        </div>
    );
}
