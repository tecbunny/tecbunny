
'use client';

import * as React from 'react';

import { MoreHorizontal, PlusCircle, ToggleLeft, ToggleRight, Trash2, Copy } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Coupon } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { CreateDiscountDialog } from '@/components/admin/CreateDiscountDialog';
import type { Discount } from '@/lib/types';
import { useToast } from '../../../../hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function CouponManagementPage() {
  const [coupons, setCoupons] = React.useState<Coupon[]>([]);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchCoupons = async () => {
        const { data, error } = await supabase.from('coupons').select('*');
        if (error) {
            console.error('Failed to fetch coupons:', error);
        } else {
            setCoupons(data as Coupon[]);
        }
    }
    fetchCoupons();
  }, [supabase]);

  const handleCouponCreated = (created: Coupon | Discount) => {
    // Guard: only add if it's a coupon (has code property)
    if ('code' in created) {
      const newCoupon = created as Coupon;
      setCoupons(prev => [...prev, newCoupon]);
      toast({
        title: 'Coupon Created',
        description: `The coupon "${newCoupon.code}" has been successfully created.`,
      });
    }
  };

  const getStatusVariant = (status: string) => {
    return status === 'active' ? 'secondary' : 'destructive';
  };

  const toggleCouponStatus = async (coupon: Coupon) => {
    const nextStatus = coupon.status === 'active' ? 'inactive' : 'active';
    setActionLoadingId(coupon.id);
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ status: nextStatus })
        .eq('id', coupon.id);

      if (error) {
        toast({
          title: 'Unable to update coupon',
          description: error.message ?? 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setCoupons(prev => prev.map(item => item.id === coupon.id ? { ...item, status: nextStatus } : item));
      toast({
        title: nextStatus === 'active' ? 'Coupon activated' : 'Coupon deactivated',
        description: `The coupon "${coupon.code}" is now ${nextStatus}.`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    const confirmed = typeof window === 'undefined' || window.confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`);
    if (!confirmed) return;

    setActionLoadingId(coupon.id);
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', coupon.id);

      if (error) {
        toast({
          title: 'Unable to delete coupon',
          description: error.message ?? 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setCoupons(prev => prev.filter(item => item.id !== coupon.id));
      toast({
        title: 'Coupon deleted',
        description: `The coupon "${coupon.code}" was removed.`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyCouponCode = async (coupon: Coupon) => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      toast({ title: 'Coupon code copied', description: `${coupon.code} copied to clipboard.` });
  } catch (_error) {
      toast({
        title: 'Unable to copy',
        description: 'Copy the code manually.',
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Coupon Management</h1>
        <p className="text-muted-foreground">
          Create and manage discount coupons for your store.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Coupons</CardTitle>
            <CardDescription>
              A list of all active and inactive coupons.
            </CardDescription>
          </div>
          <CreateDiscountDialog onDiscountCreated={handleCouponCreated} mode="coupon">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Coupon
            </Button>
          </CreateDiscountDialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono">{coupon.code}</TableCell>
                  <TableCell className="capitalize">{coupon.type}</TableCell>
                  <TableCell>{coupon.type === 'fixed' ? `₹${coupon.value}` : `${coupon.value}%`}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(coupon.status)} className="capitalize">{coupon.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(coupon.expiry_date).toLocaleDateString()}</TableCell>
                  <TableCell>{coupon.usage_count} / {coupon.usage_limit}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => copyCouponCode(coupon)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy code
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => toggleCouponStatus(coupon)}
                          disabled={actionLoadingId === coupon.id}
                        >
                          {coupon.status === 'active' ? (
                            <ToggleLeft className="mr-2 h-4 w-4" />
                          ) : (
                            <ToggleRight className="mr-2 h-4 w-4" />
                          )}
                          {coupon.status === 'active' ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteCoupon(coupon)}
                          className="text-red-600 focus:text-red-600"
                          disabled={actionLoadingId === coupon.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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
