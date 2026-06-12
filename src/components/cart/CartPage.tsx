"use client";

import * as React from "react";
import Link from "next/link";
import { Gift, ShoppingCart, Tag, ArrowRight, Lock } from "lucide-react";

import { useCart } from "@/lib/hooks";
import { logger } from "@/lib/logger";
import type { Coupon } from "@/lib/types";
import { Button } from "../ui/button";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";

import { useToast } from "../../hooks/use-toast";

import { CartItemCard } from "./CartItemCard";

const formatCurrency = (value: number) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CartPage() {
  const {
    cartItems,
    cartCount,
    cartSubtotal,
    cartGst,
    pricing,
    applyCoupon,
    removeCoupon,
    refreshPricing,
    isSessionExpired,
    resetGuestSession,
  } = useCart();
  const [couponCode, setCouponCode] = React.useState("");
  const [applyingCode, setApplyingCode] = React.useState(false);
  const { toast } = useToast();

  const fetchCouponByCode = React.useCallback(async (code: string): Promise<Coupon | null> => {
    try {
      const response = await fetch(`/api/coupons?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data as Coupon;
    } catch (error) {
      logger.error("cart_fetch_coupon_failed", { error, code });
      return null;
    }
  }, []);

  React.useEffect(() => {
    void refreshPricing();
  }, [refreshPricing]);

  const handleApplyCouponCode = async () => {
    const code = couponCode.trim();
    if (!code) {
      return;
    }

    let matchingCoupon = availableCoupons.find(
      (coupon) => coupon.code.toUpperCase() === code.toUpperCase()
    );

    if (!matchingCoupon) {
      const fetchedCoupon = await fetchCouponByCode(code.toUpperCase());
      matchingCoupon = fetchedCoupon ?? matchingCoupon;
    }

    if (!matchingCoupon) {
      toast({
        variant: "destructive",
        title: "Coupon not applicable",
        description: "This code is not valid for the current cart.",
      });
      return;
    }

    setApplyingCode(true);
    try {
      const applied = await applyCoupon(matchingCoupon);
      if (applied) {
        setCouponCode("");
      }
    } finally {
      setApplyingCode(false);
    }
  };

  const hasItems = cartItems.length > 0;
  const {
    finalTotal,
    autoOffer,
    autoOfferDiscount,
    appliedCoupon,
    couponDiscount,
    totalDiscount,
    canCombineDiscounts,
  } = pricing;
  const availableCoupons = pricing.availableCoupons;

  const subtotal = cartSubtotal;
  const gstAmount = cartGst;
  const serviceSubtotal = React.useMemo(() => {
    return cartItems.reduce((sum, item) => {
      if (item.id?.startsWith("service-")) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);
  }, [cartItems]);
  const hardwareSubtotal = Math.max(0, subtotal - serviceSubtotal);

  const { totalMrp, absoluteMrpDiscount, percentMrpDiscount } = React.useMemo(() => {
    const totals = cartItems.reduce(
      (acc, item) => {
        const itemMrp = typeof item.mrp === "number" && item.mrp > 0 ? item.mrp : item.price;
        acc.totalMrp += itemMrp * item.quantity;
        acc.totalSale += item.price * item.quantity;
        return acc;
      },
      { totalMrp: 0, totalSale: 0 }
    );

    const absoluteMrpDiscount = Math.max(0, totals.totalMrp - totals.totalSale);
    const percentMrpDiscount = totals.totalMrp > 0 ? (absoluteMrpDiscount / totals.totalMrp) * 100 : 0;

    return {
      totalMrp: totals.totalMrp,
      absoluteMrpDiscount,
      percentMrpDiscount,
    };
  }, [cartItems]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      

      <section className="pt-28 pb-16 relative">
        <div className="fixed inset-0 bg-noise opacity-5 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold font-tech tech-heading">Quote Configuration</h1>
                <p className="text-sm text-muted-foreground">
                  Review your selected hardware and request a formal quote in one step.
                </p>
              </div>
              {hasItems && (
                <Link
                  href="/products"
                  className="magnetic-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border bg-muted/20 text-foreground hover:bg-muted/40 hover:border-primary/40 transition-all text-sm font-bold"
                >
                  Continue Shopping <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>

            {isSessionExpired && (
              <Alert variant="destructive" className="border-red-500/40 bg-red-500/10 text-red-200">
                <AlertTitle>Session expired</AlertTitle>
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  Guest carts reset after a period of inactivity. Reset the cart to start again.
                  <Button size="sm" onClick={resetGuestSession} variant="outline" className="border-red-400/40 text-red-100">
                    Reset Cart
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {hasItems ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">Cart Items ({cartCount})</span>
                  </div>
                  {cartItems.map((item) => (
                    <CartItemCard key={item.id} item={item} />
                  ))}
                </div>

                <div className="lg:col-span-1">
                  <div className="sticky top-24 bento-card p-6">
                    <h3 className="text-xl font-bold text-foreground font-tech mb-6 border-b border-border pb-4 tech-heading">Order Summary</h3>

                    {absoluteMrpDiscount > 0 && (
                      <div className="rounded-lg border border-orange-400/30 bg-orange-500/15 p-4 text-xs text-orange-800 dark:text-orange-200 mb-6">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span>Total product discount</span>
                          <span>
                            ₹{formatCurrency(absoluteMrpDiscount)} ({percentMrpDiscount.toFixed(1)}% OFF)
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-orange-850/80 dark:text-orange-200/80">
                          You are saving against an MRP of ₹{formatCurrency(totalMrp)}.
                        </p>
                      </div>
                    )}

                    <div className="space-y-3 text-sm text-muted-foreground mb-6">
                      <div className="flex justify-between">
                        <span>Hardware Subtotal</span>
                        <span className="text-foreground font-medium">₹{formatCurrency(hardwareSubtotal)}</span>
                      </div>
                      {serviceSubtotal > 0 && (
                        <div className="flex justify-between">
                          <span>Installation Charges</span>
                          <span className="text-foreground font-medium">₹{formatCurrency(serviceSubtotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>GST (Estimated)</span>
                        <span className="text-foreground font-medium">₹{formatCurrency(gstAmount)}</span>
                      </div>
                      {autoOffer && autoOfferDiscount > 0 && (
                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-300 font-semibold">
                          <span>{autoOffer.title}</span>
                          <span>-₹{formatCurrency(autoOfferDiscount)}</span>
                        </div>
                      )}
                      {appliedCoupon && couponDiscount > 0 && (
                        <div className="flex items-center justify-between text-primary font-semibold">
                          <span>Coupon ({appliedCoupon.code})</span>
                          <span>-₹{formatCurrency(couponDiscount)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border pt-4 mb-8">
                      <div className="flex justify-between items-end">
                        <span className="text-muted-foreground font-bold">Estimated Total</span>
                        <span className="text-3xl font-bold text-primary font-tech">₹{formatCurrency(finalTotal)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2 text-right">Final invoice generated after site confirmation.</p>
                    </div>

                    <div className="mb-6">
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleApplyCouponCode();
                        }}
                      >
                        <div className="relative">
                          <Input
                            placeholder="Promo Code"
                            value={couponCode}
                            onChange={(event) => setCouponCode(event.target.value)}
                            className="w-full bg-muted/10 border border-border rounded-lg pl-4 pr-20 py-2 text-sm text-foreground focus-visible:ring-0 focus-visible:border-primary/50"
                          />
                          <button
                            type="submit"
                            disabled={!couponCode || applyingCode}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-50"
                          >
                            {applyingCode ? "APPLYING" : "APPLY"}
                          </button>
                        </div>
                      </form>
                      {appliedCoupon && (
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Tag className="h-3 w-3 text-primary" />
                            <span>{appliedCoupon.code}</span>
                          </div>
                          <Button size="sm" variant="ghost" onClick={removeCoupon} className="h-6 px-2 text-muted-foreground hover:text-foreground">
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>

                    {autoOffer && autoOfferDiscount > 0 && autoOffer.description && (
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-200 mb-5">
                        <div className="flex items-center justify-between">
                          <span>{autoOffer.title}</span>
                          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-200 border-none">
                            -₹{formatCurrency(autoOfferDiscount)}
                          </Badge>
                        </div>
                        <p className="mt-2 leading-relaxed text-emerald-800/80 dark:text-emerald-250/80">{autoOffer.description}</p>
                      </div>
                    )}

                    {totalDiscount > 0 && (
                      <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground mb-6 border border-border">
                        <p>
                          Total savings: ₹{formatCurrency(totalDiscount)}
                          {canCombineDiscounts ? " (offers + coupons combined)" : ""}
                        </p>
                      </div>
                    )}

                    <Button className="w-full py-3 bg-primary hover:bg-primary/95 text-white font-bold font-tech rounded-lg transition-colors shadow-sm font-medium" asChild>
                      <Link href="/checkout">REQUEST FORMAL QUOTE</Link>
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-3">
                      <Lock className="inline-block h-3.5 w-3.5 mr-1" /> Secure checkout
                    </p>
                    <Button
                      className="w-full mt-4 border border-border bg-muted/20 text-foreground hover:bg-muted/40 hover:border-primary/45"
                      variant="ghost"
                      asChild
                    >
                      <Link href="/products">Keep Shopping</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bento-card py-16 px-6 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4 border border-border">
                  <Gift className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground tech-heading">Your cart is empty</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Browse our catalogue and add products to start the quote process.
                </p>
                <Button className="mt-6 font-bold" asChild>
                  <Link href="/products">Explore Products</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
