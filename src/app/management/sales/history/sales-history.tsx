
'use client';

import * as React from 'react';

import { Printer } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/hooks';
import type { Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';

export default function BillingHistoryPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [userHistory, setUserHistory] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (user) {
      const fetchHistory = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('processed_by', user.id)
            .eq('status', 'Completed');
        
        if (error) {
            console.error('Error fetching billing history:', error);
        } else {
            setUserHistory(data as Order[]);
        }
        setLoading(false);
      }
      fetchHistory();
    }
  }, [user, supabase]);


  return (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold">Billing History</h1>
            <p className="text-muted-foreground">A record of invoices you have processed.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Your Processed Invoices</CardTitle>
                <CardDescription>A list of all invoices created by you.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invoice ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                          Array.from({length: 3}).map((_, i) => (
                            <TableRow key={`skel-${i}`}>
                              <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                              <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                            </TableRow>
                          ))
                        ) : userHistory.length > 0 ? userHistory.map(invoice => (
                            <TableRow key={invoice.id}>
                                <TableCell className="font-medium">{invoice.id.substring(0,8)}...</TableCell>
                                <TableCell>{invoice.customer_name}</TableCell>
                                <TableCell>{new Date(invoice.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <Badge variant='secondary'>
                                        {invoice.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>₹{invoice.total.toFixed(2)}</TableCell>
                                <TableCell>
                                    <Button variant="outline" size="sm" disabled>
                                        <Printer className="mr-2 h-4 w-4" />
                                        Print
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                           <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">You have not processed any invoices yet.</TableCell>
                           </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
