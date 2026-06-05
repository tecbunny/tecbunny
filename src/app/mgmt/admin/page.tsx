
'use client';

import * as React from 'react';
import Link from 'next/link';

import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface DashboardStats {
    totalUsers: number;
    totalProducts: number;
    totalOrders: number;
    monthlyRevenue: number;
    monthlyOrders: number;
    lastMonthOrders: number;
    recentActivity: Array<{
        id: string;
        type: string;
        description: string;
        date: string;
        status: string;
    }>;
}

export default function AdminDashboard() {
    const [stats, setStats] = React.useState<DashboardStats>({
        totalUsers: 0,
        totalProducts: 0,
        totalOrders: 0,
        monthlyRevenue: 0,
        monthlyOrders: 0,
        lastMonthOrders: 0,
        recentActivity: []
    });
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchStats = React.useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Add cache-busting parameter to force fresh data
            const response = await fetch(`/api/admin/dashboard?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            let data: any = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }

            if (!response.ok) {
                const rawMessage = data?.error || `HTTP error! status: ${response.status}`;
                const message = typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage);
                throw new Error(message || `HTTP error! status: ${response.status}`);
            }
            
            if (data.success && data.stats) {
                setStats(data.stats);
            } else {
                throw new Error(data.error || 'Failed to fetch dashboard data');
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            if (error instanceof Error) {
                setError(error.message);
            } else if (typeof error === 'string') {
                setError(error);
            } else {
                try {
                    setError(JSON.stringify(error));
                } catch {
                    setError('Failed to load dashboard');
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Calculate growth indicators
    const orderGrowth = stats.lastMonthOrders > 0 
        ? ((stats.monthlyOrders - stats.lastMonthOrders) / stats.lastMonthOrders * 100).toFixed(1)
        : '0';
    const isGrowthPositive = parseFloat(orderGrowth) >= 0;

    const pendingCount = stats.recentActivity.filter((activity) => activity.status === 'pending').length;
    const completedCount = stats.recentActivity.filter((activity) => activity.status === 'completed').length;

    const statusBadgeClass = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30';
            case 'pending':
                return 'bg-amber-500/10 text-amber-300 border border-amber-500/30';
            case 'cancelled':
                return 'bg-red-500/10 text-red-300 border border-red-500/30';
            default:
                return 'bg-white/5 text-slate-300 border border-white/10';
        }
    };
    return (
        <div className="min-h-screen bg-[#030712] text-slate-200">
            <style jsx global>{`
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: #030712; }
                ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: #06b6d4; }
            `}</style>

            <div className="relative">
                <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none" />

                <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 lg:px-10 space-y-8">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Admin Command</p>
                            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                            <p className="text-slate-400">A complete overview of your store's performance and operations.</p>
                        </div>
                        <Button
                            onClick={fetchStats}
                            disabled={loading}
                            variant="outline"
                            className="gap-2 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
                            <p className="text-red-200">Error loading dashboard: {error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-3 px-4 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {loading ? (
                            [1, 2, 3, 4].map((i) => (
                                <div key={i} className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 animate-pulse">
                                    <div className="h-4 w-24 rounded bg-white/10 mb-4"></div>
                                    <div className="h-8 w-20 rounded bg-white/10 mb-2"></div>
                                    <div className="h-3 w-28 rounded bg-white/10"></div>
                                </div>
                            ))
                        ) : (
                            <>
                                <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Revenue</p>
                                    <div className="mt-2 text-2xl font-bold text-white font-tech">₹{stats.monthlyRevenue.toLocaleString('en-IN')}</div>
                                    <div className="mt-2 flex items-center gap-2 text-xs">
                                        <span className={isGrowthPositive ? 'text-emerald-300' : 'text-red-300'}>
                                            {isGrowthPositive ? '▲' : '▼'} {orderGrowth}%
                                        </span>
                                        <span className="text-slate-500">vs last month</span>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pending Quotes</p>
                                    <div className="mt-2 text-2xl font-bold text-white font-tech">{pendingCount}</div>
                                    <div className="mt-2 text-xs text-amber-300 font-semibold">Action Required</div>
                                </div>

                                <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Tasks</p>
                                    <div className="mt-2 text-2xl font-bold text-white font-tech">{completedCount}</div>
                                    <div className="mt-2 text-xs text-slate-500">Completed this week</div>
                                </div>

                                <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Orders</p>
                                    <div className="mt-2 text-2xl font-bold text-white font-tech">{stats.totalOrders}</div>
                                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                                        {stats.monthlyOrders} this month
                                        {isGrowthPositive ? (
                                            <TrendingUp className="h-3 w-3 text-emerald-300" />
                                        ) : (
                                            <TrendingDown className="h-3 w-3 text-red-300" />
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                                <h3 className="font-semibold text-white tracking-wide">Recent Transmissions</h3>
                                <button className="text-xs text-cyan-300 hover:text-white">View All</button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-white/5 text-xs uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4">Activity</th>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {stats.recentActivity.length > 0 ? (
                                            stats.recentActivity.map((activity) => (
                                                <tr key={activity.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-semibold text-white">{activity.description}</p>
                                                        <p className="text-xs font-mono text-slate-500">#{activity.id}</p>
                                                    </td>
                                                    <td className="px-6 py-4">{activity.type}</td>
                                                    <td className="px-6 py-4">
                                                        {new Date(activity.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider ${statusBadgeClass(activity.status)}`}>
                                                            {activity.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-6 text-center text-slate-500">
                                                    No recent activity to display.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6">
                                <h3 className="font-semibold text-white tracking-wide mb-4">Command Protocols</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <Link href="/mgmt/admin/staff">
                                        <div className="p-3 text-center rounded-xl border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all text-xs font-semibold text-white cursor-pointer">
                                            Staff Management
                                        </div>
                                    </Link>
                                    <Link href="/mgmt/admin/inventory">
                                        <div className="p-3 text-center rounded-xl border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all text-xs font-semibold text-white cursor-pointer">
                                            Inventory Management
                                        </div>
                                    </Link>
                                    <Link href="/mgmt/admin/orders">
                                        <div className="p-3 text-center rounded-xl border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all text-xs font-semibold text-white cursor-pointer">
                                            All Orders
                                        </div>
                                    </Link>
                                    <Link href="/mgmt/admin/purchase">
                                        <div className="p-3 text-center rounded-xl border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all text-xs font-semibold text-white cursor-pointer">
                                            Purchase Entry
                                        </div>
                                    </Link>
                                    <Link href="/mgmt/admin/invoice-lookup">
                                        <div className="p-3 text-center rounded-xl border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all text-xs font-semibold text-white cursor-pointer">
                                            Invoice Lookup
                                        </div>
                                    </Link>
                                    <Link href="/mgmt/admin/quotes">
                                        <div className="p-3 text-center rounded-xl border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all text-xs font-semibold text-white cursor-pointer">
                                            Quotes Management
                                        </div>
                                    </Link>
                                </div>
                            </div>
 
                            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6">
                                <h3 className="font-semibold text-white tracking-wide mb-4">Inventory Watch</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-400">Total Products</span>
                                            <span className="text-white font-semibold">{stats.totalProducts}</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5">
                                            <div className="bg-cyan-400 h-1.5 rounded-full" style={{ width: '40%' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-400">Active Users</span>
                                            <span className="text-amber-300 font-semibold">{stats.totalUsers}</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5">
                                            <div className="bg-amber-300 h-1.5 rounded-full" style={{ width: '25%' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-400">Monthly Orders</span>
                                            <span className="text-white font-semibold">{stats.monthlyOrders}</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5">
                                            <div className="bg-purple-400 h-1.5 rounded-full" style={{ width: '55%' }}></div>
                                        </div>
                                    </div>
                                </div>
                                <Link href="/mgmt/admin/products" className="block w-full mt-6">
                                    <div className="py-2 text-xs font-semibold text-center border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-slate-400 hover:text-white cursor-pointer">
                                        View Full Inventory
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
