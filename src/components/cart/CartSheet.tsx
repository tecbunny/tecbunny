'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { LoginDialog } from '@/components/auth/LoginDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '../../hooks/use-toast';
import { logger } from '@/lib/logger';
import { useAuth, useCart } from '@/lib/hooks';
import type { Coupon } from '@/lib/types';

import { CartItemCard } from './CartItemCard';

interface CartSheetProps {
    children: React.ReactNode;
}

export function CartSheet({ children }: CartSheetProps) {
  const {
    cartItems,
    cartCount,
    cartSubtotal,
    cartGst,
    cartTotal,
    isSessionExpired,
    resetGuestSession,
    pricing,
    applyCoupon,
    removeCoupon,
    refreshPricing,
  } = useCart();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  
  const [couponCode, setCouponCode] = React.useState('');
  const [applying, setApplying] = React.useState(false);
  const subtotal = pricing?.subtotal ?? cartSubtotal;
  const gstAmount = pricing?.gstAmount ?? cartGst;
  const autoOffer = pricing?.autoOffer;
  const autoOfferDiscount = pricing?.autoOfferDiscount ?? 0;
  const appliedCoupon = pricing?.appliedCoupon ?? null;
  const couponDiscount = pricing?.couponDiscount ?? 0;
  const availableCoupons = React.useMemo(
    () => pricing?.availableCoupons ?? [],
    [pricing?.availableCoupons]
  );
  const canCombineDiscounts = pricing?.canCombineDiscounts ?? false;
  const finalTotal = pricing?.finalTotal ?? cartTotal;
  const grandTotal = Math.max(0, finalTotal);

  React.useEffect(() => {
    if (!open) return;
    void refreshPricing();
  }, [open, refreshPricing]);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(false);
      router.push('/cart');
      return;
    }
    setOpen(nextOpen);
  }, [router]);

  const fetchCouponByCode = React.useCallback(async (code: string): Promise<Coupon | null> => {
    try {
      const response = await fetch(`/api/coupons?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as Coupon;
    } catch (error) {
      logger.error('cart_sheet_fetch_coupon_failed', { error, code });
      return null;
    }
  }, []);

  const handleApplyCoupon = React.useCallback(async (code?: string) => {
    if (applying) return;
    const normalized = (code ?? couponCode).trim().toUpperCase();
    if (!normalized) return;

    setApplying(true);
    try {
      const matchingAvailable = availableCoupons.find(c => c.code.toUpperCase() === normalized);
      const coupon = matchingAvailable ?? await fetchCouponByCode(normalized);

      if (!coupon) {
        toast({ variant: 'destructive', title: 'Invalid Coupon', description: 'Coupon not found or inactive.' });
        return;
      }

      const applied = await applyCoupon(coupon);
      if (applied) {
        setCouponCode('');
      }
    } catch (error) {
      logger.error('cart_sheet_apply_coupon_failed', { error, code: normalized });
      toast({ variant: 'destructive', title: 'Coupon Error', description: 'Unable to apply coupon right now.' });
    } finally {
      setApplying(false);
    }
  }, [applying, couponCode, availableCoupons, applyCoupon, fetchCouponByCode, toast]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-lg bg-slate-950/95 text-slate-100 border-l border-white/10 backdrop-blur-xl">
        <SheetHeader className="px-6">
          <SheetTitle>Shopping Cart ({cartCount})</SheetTitle>
          {!user && (
            <div className="text-sm text-muted-foreground mt-2">
              {isSessionExpired ? (
                <div className="flex items-center justify-between bg-destructive/10 text-destructive p-2 rounded">
                  <span>Guest session expired</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetGuestSession}
                    className="ml-2"
                  >
                    Reset Session
                  </Button>
                </div>
              ) : (
                <div className="text-center text-xs bg-blue-50 text-blue-600 p-2 rounded">
                  Guest session - Cart will reset after 1 hour of inactivity
                </div>
              )}
            </div>
          )}
        </SheetHeader>
        <Separator className="my-4" />
        {cartCount > 0 ? (
          <>
            <div className="flex-1 flex flex-col gap-3 overflow-hidden">
              <ScrollArea className="flex-1 px-6">
                <div className="flex flex-col gap-3">
                    {cartItems.map((item) => (
                        <CartItemCard key={item.id} item={item} />
                    ))}
                    </div>
                </ScrollArea>
                 <div className="px-6 space-y-4">
                    <div className="space-y-2">
                        <h4 className="font-medium">Apply Discount Code</h4>
                        <div className="flex items-center gap-2">
                            <Input 
                                placeholder="Enter coupon code" 
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                                disabled={applying}
                            />
                          <Button onClick={() => void handleApplyCoupon(couponCode)} disabled={!couponCode || applying}>
                            {applying ? 'Applying...' : 'Apply'}
                          </Button>
                        </div>
                        {appliedCoupon && (
                          <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
                            <div className="font-semibold">Applied: {appliedCoupon.code}</div>
                            <Button size="sm" variant="ghost" onClick={removeCoupon}>Remove</Button>
                          </div>
                        )}
                    </div>
                    {availableCoupons.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Available Coupons</h4>
                        <div className="grid gap-2">
                          {availableCoupons.map((coupon) => (
                            <div key={coupon.code} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                              <div>
                                <p className="text-sm font-semibold">{coupon.code}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => void handleApplyCoupon(coupon.code)} disabled={applying}>
                                Apply
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Enter a valid coupon code to redeem savings. Available coupons are personalized based on your cart.
                    </p>
                </div>
            </div>
            
            <SheetFooter className="px-6 bg-secondary/50 pt-4 pb-6 mt-auto">
                <div className="w-full space-y-2">
                    <div className="flex justify-between text-base">
                        <span>Subtotal</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base">
                        <span>GST</span>
                        <span>₹{gstAmount.toFixed(2)}</span>
                    </div>
                    {autoOfferDiscount > 0 && (
                        <div className="flex justify-between text-base text-green-500">
                          <span>Auto Offer{autoOffer ? ` (${autoOffer.title})` : ''}</span>
                          <span>- ₹{autoOfferDiscount.toFixed(2)}</span>
                        </div>
                    )}
                    {couponDiscount > 0 && (
                        <div className="flex justify-between text-base text-amber-400">
                            <span>Coupon {appliedCoupon ? `(${appliedCoupon.code})` : ''}</span>
                            <span>- ₹{couponDiscount.toFixed(2)}</span>
                        </div>
                    )}
                    {autoOfferDiscount > 0 && couponDiscount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {canCombineDiscounts ? 'Auto offer and coupon combined for this cart.' : 'Best discount automatically applied.'}
                      </p>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-semibold">
                        <span>Grand Total</span>
                        <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Shipping calculated at checkout.</p>
                    {!user && (
                      <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        Login is required to complete checkout.
                      </div>
                    )}
                    {user ? (
                      <Button className="w-full" size="lg" asChild>
                        <Link href="/checkout" onClick={() => setOpen(false)}>
                            Proceed to Checkout
                        </Link>
                      </Button>
                    ) : (
                      <LoginDialog>
                        <Button className="w-full" size="lg" onClick={() => setOpen(false)}>
                          Login to Checkout
                        </Button>
                      </LoginDialog>
                    )}
                    <Button variant="secondary" className="w-full" asChild>
                      <Link href="/cart" onClick={() => setOpen(false)}>View Full Cart</Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/" onClick={() => setOpen(false)}>Continue Shopping</Link>
                    </Button>
                </div>
            </SheetFooter>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <h3 className="text-xl font-semibold">Your cart is empty</h3>
            <p className="text-muted-foreground">
              Looks like you haven't added anything yet.
            </p>
            <Button asChild onClick={() => setOpen(false)}>
              <Link href="/">Start Shopping</Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}