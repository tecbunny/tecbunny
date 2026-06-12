'use client';

import * as React from 'react';

import { RefreshCw } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Order, OrderType, OrderStatus } from '@/lib/types';
import { useToast } from '../../hooks/use-toast';
import { OrderActions } from '../sales/OrderActions';
import { formatOrderNumber } from '@/lib/order-utils';
import { createClient } from '@/lib/supabase/client';

const STATUS_VARIANT: Record<OrderStatus, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  'Pending': 'outline',
  'Awaiting Payment': 'destructive',
  'Payment Failed': 'destructive',
  'Payment Confirmed': 'default',
  'Confirmed': 'default',
  'Processing': 'default',
  'Ready to Ship': 'default',
  'Shipped': 'secondary',
  'Ready for Pickup': 'default',
  'Ready for Delivery': 'default',
  'Delivered': 'outline',
  'Delivered/Picked Up': 'outline',
  'Completed': 'outline',
  'On Hold': 'outline',
  'Visit Scheduled': 'default',
  'Visit Completed': 'default',
  'Diagnosis Done': 'default',
  'Quote Sent': 'default',
  'Awaiting Customer Approval': 'default',
  'Approved': 'default',
  'Parts Ordered': 'default',
  'Work In Progress': 'default',
  'Quality Check': 'default',
  'Warranty/Support Active': 'default',
  'Cancelled': 'destructive',
  'Rejected': 'destructive',
};

const TYPE_BADGE_CLASS: Record<OrderType, string> = {
  Delivery: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  Pickup: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
  'Walk-in': 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
  Service: 'bg-primary/10 text-primary border border-primary/20',
  Repair: 'bg-purple-500/10 text-purple-500 border border-purple-500/20',
  Installation: 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20',
  Setup: 'bg-sky-500/10 text-sky-500 border border-sky-500/20',
};

type TypeFilter = 'all' | OrderType;

interface OrderDataTableProps {
  role: 'ADMIN' | 'SALES';
}

export default function OrderDataTable({ role }: OrderDataTableProps) {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalOrders, setTotalOrders] = React.useState(0);
  const { toast } = useToast();
  const fetchControllerRef = React.useRef<AbortController | null>(null);
  const supabase = createClient();

  const fetchOrders = React.useCallback(async () => {
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    setLoading(true);

    try {
      if (role === 'ADMIN') {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });

        if (typeFilter !== 'all') {
          params.set('type', typeFilter);
        }

        const response = await fetch(`/api/admin/orders?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load orders. Please try again.');
        }

        setOrders(Array.isArray(payload?.orders) ? payload.orders : []);
        const pagination = payload?.pagination;
        setTotalOrders(pagination?.total ?? (payload?.orders?.length ?? 0));
        setTotalPages(Math.max(1, pagination?.pages ?? 1));
      } else {
        // SALES role fetching logic
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            // Using logic from sales-orders.tsx to fetch Pickup orders or apply filters
            .eq('type', typeFilter !== 'all' ? typeFilter : 'Pickup')
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error('Failed to fetch orders. Please try again.');
        } else {
            setOrders(data as Order[]);
            setTotalOrders(data.length);
            setTotalPages(1);
        }
      }
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        return;
      }
      console.error(`Error fetching ${role.toLowerCase()} orders:`, error);
      toast({
        variant: 'destructive',
        title: 'Order fetch failed',
        description: error instanceof Error ? error.message : 'Unable to load orders. Please try again.',
      });
      setOrders([]);
      setTotalOrders(0);
      setTotalPages(1);
    } finally {
      if (fetchControllerRef.current === controller) {
        fetchControllerRef.current = null;
        setLoading(false);
      }
    }
  }, [limit, page, toast, typeFilter, role, supabase]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  React.useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, []);

  const filteredOrders = React.useMemo(() => {
    if (role === 'ADMIN' && typeFilter === 'all') return orders;
    if (role === 'ADMIN') return orders.filter(order => order.type === typeFilter);
    return orders; // SALES filters are applied in supabase query
  }, [orders, typeFilter, role]);

  const getStatusBadgeVariant = (status: OrderStatus) => STATUS_VARIANT[status] ?? 'outline';

  const getTypeBadgeClass = (type: OrderType | null | undefined) => {
    if (!type || !(type in TYPE_BADGE_CLASS)) {
      return 'bg-gray-100 text-gray-700';
    }
    return TYPE_BADGE_CLASS[type as OrderType];
  };

  const getStatusLabel = (order: Order) => {
    if (['Awaiting Payment', 'Pending'].includes(order.status) && (order.payment_method ?? '').toLowerCase() === 'upi') {
      return 'Payment Confirmation Pending';
    }
    return order.status;
  };

  const getPaymentStatusLabel = (order: Order) => {
    if (order.payment_status && order.payment_status.trim().length > 0) {
      return order.payment_status;
    }

    if (['Awaiting Payment', 'Pending'].includes(order.status)) {
      return (order.payment_method ?? '').toLowerCase() === 'upi'
        ? 'Payment Confirmation Pending'
        : 'Awaiting Payment';
    }

    if (['Payment Confirmed', 'Confirmed', 'Processing', 'Ready to Ship', 'Shipped', 'Ready for Pickup', 'Completed', 'Delivered'].includes(order.status)) {
      return 'Payment Confirmed';
    }

    if (['Cancelled', 'Rejected'].includes(order.status)) {
      return 'Payment Cancelled';
    }

    return 'Pending';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{role === 'ADMIN' ? 'Order Management' : 'Pickup Orders'}</h1>
          <p className="text-muted-foreground">
            {role === 'ADMIN' 
              ? 'Monitor and control every order across the storefront.' 
              : 'Manage and track orders designated for in-store pickup.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {role === 'ADMIN' && (
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setPage(1);
                setTypeFilter(value as TypeFilter);
              }}
            >
              <SelectTrigger className="min-w-[160px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All order types</SelectItem>
                <SelectItem value="Delivery">Delivery</SelectItem>
                <SelectItem value="Pickup">Pickup</SelectItem>
                <SelectItem value="Walk-in">Walk-in</SelectItem>
                <SelectItem value="Service">Service</SelectItem>
                <SelectItem value="Repair">Repair</SelectItem>
                <SelectItem value="Installation">Installation</SelectItem>
                <SelectItem value="Setup">Setup</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={loading}
            onClick={fetchOrders}
          >
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        </div>
      </div>

      {role === 'ADMIN' ? (
        <Card className="border-l-2 border-l-primary bg-primary/5 border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-foreground">
              Admins can review, update, and cancel any order. Use the actions menu in each row to adjust order status,
              print invoices, or drill into a full order view.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-l-2 border-l-emerald-500 bg-emerald-500/5 border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
              <div>
                <p className="font-medium text-foreground">Sales & Manager Access</p>
                <p className="text-sm text-muted-foreground">You can view and manage all pickup order statuses.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{role === 'ADMIN' ? 'Orders' : 'Active Pickup Orders'}</CardTitle>
          <CardDescription>
            {role === 'ADMIN' ? 'Recent orders across all channels.' : 'A list of all current pickup orders.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                {role === 'ADMIN' && <TableHead>Type</TableHead>}
                <TableHead>{role === 'ADMIN' ? 'Placed' : 'Date'}</TableHead>
                <TableHead>Status</TableHead>
                {role === 'ADMIN' && <TableHead>Payment</TableHead>}
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={`order-skeleton-${index}`}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </TableCell>
                    {role === 'ADMIN' && <TableCell><Skeleton className="h-5 w-16" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    {role === 'ADMIN' && <TableCell><Skeleton className="h-5 w-20" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={role === 'ADMIN' ? 8 : 6} className="py-12 text-center text-muted-foreground">
                    No orders found for the selected filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{formatOrderNumber(order.id)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{order.customer_name || 'Unknown customer'}</p>
                        {order.customer_email && (
                          <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                        )}
                        {order.customer_phone && (
                          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                        )}
                      </div>
                    </TableCell>
                    {role === 'ADMIN' && (
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTypeBadgeClass(order.type)}`}>
                          {order.type || 'Unknown'}
                        </span>
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <p>{new Date(order.created_at).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(order.status)}>{role === 'ADMIN' ? getStatusLabel(order) : order.status}</Badge>
                    </TableCell>
                    {role === 'ADMIN' && (
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <p>{order.payment_method ? order.payment_method.toUpperCase() : 'Not set'}</p>
                          <p className="text-muted-foreground">{getPaymentStatusLabel(order)}</p>
                          {order.payment_reference && (
                            <p className="text-xs text-muted-foreground">Ref: {order.payment_reference}</p>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <p className="font-medium">₹{order.total.toFixed(2)}</p>
                        {role === 'ADMIN' && (order.discount_amount || order.shipping_amount) && (
                          <p className="text-xs text-muted-foreground">
                            {order.discount_amount ? `Disc: ₹${order.discount_amount.toFixed(2)}` : ''}
                            {order.shipping_amount ? ` Ship: ₹${order.shipping_amount.toFixed(2)}` : ''}
                          </p>
                        )}
                        {role === 'SALES' && order.payment_method && (
                          <p className="text-xs text-muted-foreground">{order.payment_method}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <OrderActions order={order} onStatusUpdate={fetchOrders} variant="dropdown" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!loading && role === 'ADMIN' && (
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} • {totalOrders} orders
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Select
                  value={String(limit)}
                  onValueChange={(value) => {
                    setPage(1);
                    setLimit(Number(value));
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Rows per page" />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} per page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1 || loading}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
