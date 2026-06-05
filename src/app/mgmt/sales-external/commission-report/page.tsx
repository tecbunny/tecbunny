'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks';
import { createClient } from '@/lib/supabase/client';
import { DollarSign, Percent, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

interface CommissionRecord {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  order_id: string;
  orders?: {
    total: number;
    customer_name: string;
  };
}

export default function CommissionReportPage() {
  const { user } = useAuth();
  const supabase = React.useMemo(() => createClient(), []);
  const [commissions, setCommissions] = React.useState<CommissionRecord[]>([]);
  const [stats, setStats] = React.useState({ pending: 0, paid: 0, total: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;

    const loadCommissions = async () => {
      setLoading(true);
      setError(null);
      try {
        // Query sales_agent_commissions table.
        // If the table doesn't exist or column is named user_id, it will be handled.
        let data: any[] | null = null;
        let queryError: any = null;

        // Try querying using agent_id first
        const attempt1 = await supabase
          .from('sales_agent_commissions')
          .select('id, amount, status, created_at, order_id, orders(total, customer_name)')
          .eq('agent_id', user.id)
          .order('created_at', { ascending: false });

        if (attempt1.error) {
          // Fall back to user_id just in case
          const attempt2 = await supabase
            .from('sales_agent_commissions')
            .select('id, amount, status, created_at, order_id, orders(total, customer_name)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          
          if (attempt2.error) {
            queryError = attempt2.error;
          } else {
            data = attempt2.data;
          }
        } else {
          data = attempt1.data;
        }

        if (queryError) {
          // If table doesn't exist, we will mock or display empty states instead of crashing
          console.warn('Commissions table not queryable:', queryError);
          setCommissions([]);
          return;
        }

        if (data) {
          const records = data as CommissionRecord[];
          const paidAmt = records.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.amount || 0), 0);
          const pendingAmt = records.filter(r => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount || 0), 0);
          const totalAmt = paidAmt + pendingAmt;

          setStats({
            paid: paidAmt,
            pending: pendingAmt,
            total: totalAmt
          });
          setCommissions(records);
        }
      } catch (err) {
        console.error('Failed to load commissions:', err);
        setError('Error loading payout tables. Please check connection.');
      } finally {
        setLoading(false);
      }
    };

    loadCommissions();
  }, [user, supabase]);

  return (
    <div className="space-y-8 bg-slate-950 min-h-screen text-slate-100 p-1">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400">Commission Center</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">My Commission Report</h1>
        <p className="text-slate-400 text-sm mt-1">
          Detailed metrics showing pending clearances and past payouts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-900 border-white/10 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cleared Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-28 bg-white/5" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">₹{stats.paid.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-500">Transferred to registered bank</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-white/10 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Percent className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-28 bg-white/5" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">₹{stats.pending.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-500">Awaiting cycle closure</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-white/10 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cumulative Commissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-28 bg-white/5" />
            ) : (
              <>
                <div className="text-2xl font-bold font-tech">₹{stats.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-500">All-time earnings history</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      <Card className="bg-slate-900 border-white/10 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-400" />
            Ledger Activity
          </CardTitle>
          <CardDescription className="text-slate-400">
            A comprehensive statement of commissions generated from remote client checkouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="border-white/10">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-slate-400">Date</TableHead>
                <TableHead className="text-slate-400">Transaction ID</TableHead>
                <TableHead className="text-slate-400">Customer</TableHead>
                <TableHead className="text-slate-400">Order Value</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400 text-right">Commission Amt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="border-white/5">
                    <TableCell><Skeleton className="h-5 w-20 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 bg-white/5" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto bg-white/5" /></TableCell>
                  </TableRow>
                ))
              ) : commissions.length > 0 ? (
                commissions.map((rec) => (
                  <TableRow key={rec.id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="text-slate-400">
                      {new Date(rec.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {rec.order_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-semibold text-white">
                      {rec.orders?.customer_name || 'Affiliate Checkout'}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      ₹{Number(rec.orders?.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          rec.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                            : rec.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/10 text-red-300 border border-red-500/30'
                        }
                      >
                        {rec.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-emerald-400 font-tech">
                      ₹{Number(rec.amount || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-6">
                    No commission payouts listed for this account yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
