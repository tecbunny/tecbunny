
'use client';

import * as React from 'react';

import { MoreHorizontal, Printer } from 'lucide-react';

import { formatInvoiceDate, formatOrderNumber } from '../../../../lib/order-utils';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table';
import { Button } from '../../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../../../components/ui/dropdown-menu';
import type { Order, OrderStatus } from '../../../../lib/types';
import { Badge } from '../../../../components/ui/badge';
import { Skeleton } from '../../../../components/ui/skeleton';
import { createClient } from '../../../../lib/supabase/client';

export default function InvoicesPage() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const supabase = createClient();

  React.useEffect(() => {
    const fetchInvoices = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching invoices:', error);
        } else {
            setOrders(data as Order[]);
        }
        setLoading(false);
    };

    fetchInvoices();
  }, [supabase]);


  const getBadgeVariant = (status: OrderStatus) => {
    switch (status) {
        case 'Pending': return 'destructive';
        case 'Processing': return 'default';
        case 'Ready for Pickup': return 'default';
        case 'Shipped': return 'default';
        case 'Completed': return 'secondary';
        case 'Delivered': return 'secondary';
        default: return 'outline';
    }
  }


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Invoice Management</h1>
        <p className="text-muted-foreground">
          Manage and track all customer invoices.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            A list of all invoices across all statuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({length: 5}).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : orders.map((order: Order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{formatOrderNumber(order.id)}</TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell>{formatInvoiceDate(order.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(order.status)}>
                        {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.type}</TableCell>
                  <TableCell>₹{order.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>
                            <Printer className="mr-2 h-4 w-4" />
                            Print Invoice
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
