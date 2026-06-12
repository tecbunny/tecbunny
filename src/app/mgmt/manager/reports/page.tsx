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
    <div className="space-y-8 bg-background min-h-screen text-foreground p-1">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Reports Engine</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Management Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Detailed team performance indicators and sales volume metrics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border text-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Sales Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-28 bg-muted" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">₹{totalTeamVolume.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Cumulative completed orders</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border text-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-16 bg-muted" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">{totalTeamSales}</div>
                <p className="text-xs text-muted-foreground">Completed order count</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border text-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Own Volume</CardTitle>
            <Award className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-28 bg-muted" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">₹{selfStats.volume.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">{selfStats.count} orders processed by me</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border text-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Salespersons</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-12 bg-muted" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">{salespersons.length}</div>
                <p className="text-xs text-muted-foreground">Registered sales staff</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card border-border text-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              Salesperson League Table
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Coordinated sales agents ranked by volume generated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="border-border">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead className="text-muted-foreground text-right">Orders</TableHead>
                  <TableHead className="text-muted-foreground text-right">Total Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell><Skeleton className="h-5 w-24 bg-muted" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32 bg-muted" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-10 ml-auto bg-muted" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto bg-muted" /></TableCell>
                    </TableRow>
                  ))
                ) : salespersons.length > 0 ? (
                  salespersons.map((sp) => (
                    <TableRow key={sp.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-semibold text-foreground">{sp.name}</TableCell>
                      <TableCell className="text-muted-foreground">{sp.email}</TableCell>
                      <TableCell className="text-right text-foreground font-mono">{sp.salesCount}</TableCell>
                      <TableCell className="text-right text-emerald-500 font-tech font-semibold">
                        ₹{sp.totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      No sales representatives found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-card border-border text-foreground">
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription className="text-muted-foreground">
              Local coordination notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p className="leading-relaxed font-tech">
              This panel shows the sales figures for the staff currently coordinated under your direct oversight.
            </p>
            <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
              <h4 className="font-bold text-foreground uppercase text-xs tracking-wider">Manager Protocols</h4>
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground">
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
