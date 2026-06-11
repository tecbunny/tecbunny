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
    <div className="min-h-screen bg-[#030712] text-slate-200">
      

      <section className="pt-28 pb-16 relative">
        <div className="fixed inset-0 bg-noise opacity-5 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white font-tech">Quote Configuration</h1>
                <p className="text-sm text-slate-400">
                  Review your selected hardware and request a formal quote in one step.
                </p>
              </div>
              {hasItems && (
                <Link
                  href="/products"
                  className="magnetic-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-cyan-300/40 transition-all text-sm font-bold"
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
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <ShoppingCart className="h-4 w-4 text-cyan-300" />
                    <span className="font-semibold text-white">Cart Items ({cartCount})</span>
                  </div>
                  {cartItems.map((item) => (
                    <CartItemCard key={item.id} item={item} />
                  ))}
                </div>

                <div className="lg:col-span-1">
                  <div className="sticky top-24 glass-panel p-6 rounded-2xl">
                    <h3 className="text-xl font-bold text-white font-tech mb-6 border-b border-white/10 pb-4">Order Summary</h3>

                    {absoluteMrpDiscount > 0 && (
                      <div className="rounded-lg border border-orange-400/30 bg-orange-500/10 p-4 text-xs text-orange-200 mb-6">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span>Total product discount</span>
                          <span>
                            ₹{formatCurrency(absoluteMrpDiscount)} ({percentMrpDiscount.toFixed(1)}% OFF)
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-orange-200/80">
                          You are saving against an MRP of ₹{formatCurrency(totalMrp)}.
                        </p>
                      </div>
                    )}

                    <div className="space-y-3 text-sm text-slate-400 mb-6">
                      <div className="flex justify-between">
                        <span>Hardware Subtotal</span>
                        <span className="text-white">₹{formatCurrency(hardwareSubtotal)}</span>
                      </div>
                      {serviceSubtotal > 0 && (
                        <div className="flex justify-between">
                          <span>Installation Charges</span>
                          <span className="text-white">₹{formatCurrency(serviceSubtotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>GST (Estimated)</span>
                        <span className="text-white">₹{formatCurrency(gstAmount)}</span>
                      </div>
                      {autoOffer && autoOfferDiscount > 0 && (
                        <div className="flex items-center justify-between text-emerald-300 font-semibold">
                          <span>{autoOffer.title}</span>
                          <span>-₹{formatCurrency(autoOfferDiscount)}</span>
                        </div>
                      )}
                      {appliedCoupon && couponDiscount > 0 && (
                        <div className="flex items-center justify-between text-cyan-300 font-semibold">
                          <span>Coupon ({appliedCoupon.code})</span>
                          <span>-₹{formatCurrency(couponDiscount)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/10 pt-4 mb-8">
                      <div className="flex justify-between items-end">
                        <span className="text-slate-300 font-bold">Estimated Total</span>
                        <span className="text-3xl font-bold text-cyan-300 font-tech">₹{formatCurrency(finalTotal)}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 text-right">Final invoice generated after site confirmation.</p>
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
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-20 py-2 text-sm text-white focus-visible:ring-0 focus-visible:border-cyan-400/50"
                          />
                          <button
                            type="submit"
                            disabled={!couponCode || applyingCode}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-cyan-300 hover:text-white disabled:opacity-50"
                          >
                            {applyingCode ? "APPLYING" : "APPLY"}
                          </button>
                        </div>
                      </form>
                      {appliedCoupon && (
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            <Tag className="h-3 w-3 text-cyan-300" />
                            <span>{appliedCoupon.code}</span>
                          </div>
                          <Button size="sm" variant="ghost" onClick={removeCoupon} className="h-6 px-2 text-slate-300 hover:text-white">
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>

                    {autoOffer && autoOfferDiscount > 0 && autoOffer.description && (
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200 mb-5">
                        <div className="flex items-center justify-between">
                          <span>{autoOffer.title}</span>
                          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-200">
                            -₹{formatCurrency(autoOfferDiscount)}
                          </Badge>
                        </div>
                        <p className="mt-2 leading-relaxed text-emerald-200/80">{autoOffer.description}</p>
                      </div>
                    )}

                    {totalDiscount > 0 && (
                      <div className="rounded-md bg-white/5 p-3 text-xs text-slate-400 mb-6">
                        <p>
                          Total savings: ₹{formatCurrency(totalDiscount)}
                          {canCombineDiscounts ? " (offers + coupons combined)" : ""}
                        </p>
                      </div>
                    )}

                    <Button className="w-full py-3 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-white hover:text-slate-900 text-white font-bold font-tech rounded-lg transition-colors shadow-lg shadow-cyan-400/20" asChild>
                      <Link href="/checkout">REQUEST FORMAL QUOTE</Link>
                    </Button>
                    <p className="text-xs text-center text-slate-500 mt-3">
                      <Lock className="inline-block h-3.5 w-3.5 mr-1" /> Secure checkout
                    </p>
                    <Button
                      className="w-full mt-4 border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-cyan-300/40"
                      variant="ghost"
                      asChild
                    >
                      <Link href="/products">Keep Shopping</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl py-16 px-6 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Gift className="h-8 w-8 text-slate-500" />
                </div>
                <h2 className="text-2xl font-semibold text-white">Your cart is empty</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Browse our catalogue and add products to start the quote process.
                </p>
                <Button className="mt-6" asChild>
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
