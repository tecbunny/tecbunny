
'use client';

import * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Order } from '@/lib/types';
import { useToast } from '../../../../hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks';
import { isManagerClient } from '@/lib/permissions-client';
import { OrderActions } from '@/components/sales/OrderActions';
import { formatOrderNumber } from '@/lib/order-utils';

export default function OnlineOrdersPage() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const { user } = useAuth();
  const supabase = createClient();

  const canManageOrders = isManagerClient(user);

  const fetchOrders = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('type', 'Delivery')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching online orders:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch orders. Please try again.'
        });
    } else {
        setOrders(data as Order[]);
    }
    setLoading(false);
  }, [supabase, toast]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getBadgeVariant = (status: string) => {
    switch (status) {
        case 'Awaiting Payment': return 'destructive';
        case 'Payment Confirmed': return 'default';
        case 'Confirmed': return 'default';
        case 'Processing': return 'default';
        case 'Ready to Ship': return 'default';
        case 'Shipped': return 'secondary';
        case 'Delivered': return 'outline';
        case 'Cancelled': case 'Rejected': return 'destructive';
        default: return 'outline';
    }
  };


  return (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold">Online Orders</h1>
            <p className="text-muted-foreground">View and process online orders for delivery.</p>
        </div>
        
        {/* Role-based permission notice */}
        <Card className={`border-l-4 ${canManageOrders ? 'border-l-green-500 bg-green-50' : 'border-l-orange-500 bg-orange-50'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {canManageOrders ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <div>
                    <p className="font-medium text-green-800">Manager Access</p>
                    <p className="text-sm text-green-700">You can view and manage all online order statuses.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                  <div>
                    <p className="font-medium text-orange-800">Sales View</p>
                    <p className="text-sm text-orange-700">You can view online orders. Manager permission required for status changes.</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Delivery Orders</CardTitle>
                <CardDescription>A list of all online orders requiring action.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
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
                              <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : orders.map(order => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">{formatOrderNumber(order.id)}</TableCell>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{order.customer_name}</p>
                                        {order.customer_email && (
                                          <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                                        )}
                                        {order.customer_phone && (
                                          <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div>
                                        <p>{new Date(order.created_at).toLocaleDateString()}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {new Date(order.created_at).toLocaleTimeString()}
                                        </p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getBadgeVariant(order.status)}>
                                            {order.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">₹{order.total.toFixed(2)}</p>
                                        {order.payment_method && (
                                          <p className="text-sm text-muted-foreground">{order.payment_method}</p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <OrderActions 
                                        order={order} 
                                        onStatusUpdate={fetchOrders}
                                        variant="dropdown"
                                      />
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
