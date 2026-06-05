'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks';
import { createClient } from '@/lib/supabase/client';
import { BarChart, DollarSign, Users, Award, TrendingUp } from 'lucide-react';

interface SalespersonPerformance {
  id: string;
  name: string;
  email: string;
  salesCount: number;
  totalVolume: number;
}

export default function ManagerReportsPage() {
  const { user } = useAuth();
  const supabase = React.useMemo(() => createClient(), []);
  const [salespersons, setSalespersons] = React.useState<SalespersonPerformance[]>([]);
  const [selfStats, setSelfStats] = React.useState({ count: 0, volume: 0 });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;

    const loadReportsData = async () => {
      setLoading(true);
      try {
        // 1. Fetch own stats
        const { data: selfOrders } = await supabase
          .from('orders')
          .select('total')
          .eq('processed_by', user.id)
          .eq('status', 'Completed');

        const selfVol = (selfOrders || []).reduce((acc, order) => acc + Number(order.total || 0), 0);
        setSelfStats({
          count: selfOrders?.length || 0,
          volume: selfVol,
        });

        // 2. Fetch salespersons list
        const { data: agents } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('role', ['sales', 'sales-staff']);

        if (agents && agents.length > 0) {
          const perfList: SalespersonPerformance[] = [];
          for (const agent of agents) {
            const { data: agentOrders } = await supabase
              .from('orders')
              .select('total')
              .eq('processed_by', agent.id)
              .eq('status', 'Completed');

            const agentVol = (agentOrders || []).reduce((acc, order) => acc + Number(order.total || 0), 0);
            perfList.push({
              id: agent.id,
              name: agent.name || 'Unnamed Agent',
              email: agent.email || '',
              salesCount: agentOrders?.length || 0,
              totalVolume: agentVol,
            });
          }
          // Sort by volume descending
          perfList.sort((a, b) => b.totalVolume - a.totalVolume);
          setSalespersons(perfList);
        }
      } catch (err) {
        console.error('Failed to load reports data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadReportsData();
  }, [user, supabase]);

  const totalTeamVolume = salespersons.reduce((acc, sp) => acc + sp.totalVolume, 0) + selfStats.volume;
  const totalTeamSales = salespersons.reduce((acc, sp) => acc + sp.salesCount, 0) + selfStats.count;

  return (
    <div className="space-y-8 bg-slate-950 min-h-screen text-slate-100 p-1">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400">Reports Engine</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">Management Reports</h1>
        <p className="text-slate-400 text-sm mt-1">
          Detailed team performance indicators and sales volume metrics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900 border-white/10 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Sales Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-28 bg-white/5" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">₹{totalTeamVolume.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-500">Cumulative completed orders</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-white/10 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-16 bg-white/5" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">{totalTeamSales}</div>
                <p className="text-xs text-slate-500">Completed order count</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-white/10 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Own Volume</CardTitle>
            <Award className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-28 bg-white/5" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">₹{selfStats.volume.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-500">{selfStats.count} orders processed by me</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-white/10 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Salespersons</CardTitle>
            <Users className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-12 bg-white/5" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">{salespersons.length}</div>
                <p className="text-xs text-slate-500">Registered sales staff</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-slate-900 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-indigo-400" />
              Salesperson League Table
            </CardTitle>
            <CardDescription className="text-slate-400">
              Coordinated sales agents ranked by volume generated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="border-white/10">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-400 text-right">Orders</TableHead>
                  <TableHead className="text-slate-400 text-right">Total Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="border-white/5">
                      <TableCell><Skeleton className="h-5 w-24 bg-white/5" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32 bg-white/5" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-10 ml-auto bg-white/5" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto bg-white/5" /></TableCell>
                    </TableRow>
                  ))
                ) : salespersons.length > 0 ? (
                  salespersons.map((sp) => (
                    <TableRow key={sp.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-semibold text-white">{sp.name}</TableCell>
                      <TableCell className="text-slate-400">{sp.email}</TableCell>
                      <TableCell className="text-right text-white font-mono">{sp.salesCount}</TableCell>
                      <TableCell className="text-right text-emerald-400 font-tech">
                        ₹{sp.totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-6">
                      No sales representatives found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-white/10 text-white">
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription className="text-slate-400">
              Local coordination notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <p className="leading-relaxed">
              This panel shows the sales figures for the staff currently coordinated under your direct oversight.
            </p>
            <div className="rounded-xl border border-white/10 bg-slate-950 p-4 space-y-2">
              <h4 className="font-bold text-white uppercase text-xs tracking-wider">Manager Protocols</h4>
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-400">
                <li>Verify walk-in billing records daily</li>
                <li>Audit POS receipts matches on-site cash drawers</li>
                <li>Monitor salespersons volume parameters</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
