
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
        <div className="space-y-8">
             <div>
                <h1 className="text-3xl font-bold">Sales Dashboard</h1>
                <p className="text-muted-foreground">An overview of today's sales and order activities.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-7 w-24" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">₹{stats.todayRevenue.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground">Updated for today</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New Customers Today</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-7 w-16" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">+{stats.newCustomers}</div>
                                <p className="text-xs text-muted-foreground">New customer accounts today</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Pickups</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-7 w-12" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{stats.pendingPickups}</div>
                                <p className="text-xs text-muted-foreground">Ready for customer</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                {user?.role === 'manager' && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-7 w-12" />
                            ) : (
                                <>
                                    <div className="text-2xl font-bold">{stats.pendingDeliveries}</div>
                                    <p className="text-xs text-muted-foreground">Needs processing</p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                     <CardDescription>Latest store, pickup, and delivery activity.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : recentOrders.length === 0 ? (
                        <p className="text-muted-foreground">No recent orders found for your view.</p>
                    ) : (
                        <div className="space-y-4">
                            {recentOrders.map((order) => (
                                <div key={order.id} className="flex items-center justify-between rounded-md border p-3">
                                    <div>
                                        <p className="font-medium">{order.customer_name || 'Walk-in customer'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(order.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant="secondary" className="mb-1">{order.status}</Badge>
                                        <div className="font-semibold">₹{Number(order.total ?? 0).toFixed(2)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {referralCode && (
                <div className="mt-8">
                    <MarketingKitTerminal referralCode={referralCode} />
                </div>
            )}
        </div>
    );
}
