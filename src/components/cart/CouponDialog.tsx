
'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Coupon } from '@/lib/types';

import { ScrollArea } from '../ui/scroll-area';

interface CouponDialogProps {
  availableCoupons: Coupon[];
  onCouponSelected: (coupon: Coupon | null) => void;
  appliedCouponCode?: string;
}

export function CouponDialog({ availableCoupons, onCouponSelected, appliedCouponCode }: CouponDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | undefined>(appliedCouponCode ? availableCoupons.find(c => c.code === appliedCouponCode)?.id : undefined);
  
  React.useEffect(() => {
    setSelectedId(appliedCouponCode ? availableCoupons.find(c => c.code === appliedCouponCode)?.id : undefined);
  }, [appliedCouponCode, availableCoupons]);

  const handleApply = () => {
    const selectedCoupon = availableCoupons.find(c => c.id === selectedId);
    if (selectedCoupon) {
      onCouponSelected(selectedCoupon);
    }
    setOpen(false);
  };
  
  const handleCancel = () => {
    // Reset selection to the currently applied one when canceling
    setSelectedId(appliedCouponCode ? availableCoupons.find(c => c.code === appliedCouponCode)?.id : undefined);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="p-0 h-auto">View Available Offers</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Available Coupons & Offers</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-72">
            <RadioGroup value={selectedId} onValueChange={setSelectedId} className="p-1 space-y-2">
                {availableCoupons.length > 0 ? availableCoupons.map(coupon => (
                    <div key={coupon.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={coupon.id} id={coupon.id} />
                        <Label htmlFor={coupon.id} className="font-normal cursor-pointer">
                            <span className="font-semibold">{coupon.code}</span> - {coupon.type === 'fixed' ? `₹${coupon.value}` : `${coupon.value}%`} off
                            {coupon.min_purchase && <p className="text-xs text-muted-foreground">on orders over ₹{coupon.min_purchase}</p>}
                        </Label>
                    </div>
                )) : <p className="text-sm text-muted-foreground text-center py-4">No coupons available for your cart.</p>}
            </RadioGroup>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleApply} disabled={!selectedId}>Apply Coupon</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}