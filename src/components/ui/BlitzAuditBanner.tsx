"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DISMISS_STORAGE_KEY = "tecbunny_promo_dismissed_until";

type PromoBannerState = "hidden" | "collapsed" | "expanded";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const until = window.sessionStorage.getItem(DISMISS_STORAGE_KEY);
  if (!until) return false;
  const expiry = Number.parseInt(until, 10);
  if (!Number.isFinite(expiry) || Date.now() > expiry) {
    window.sessionStorage.removeItem(DISMISS_STORAGE_KEY);
    return false;
  }
  return true;
}

function dismissForSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + 12 * 60 * 60 * 1000));
}

function syncPromoBannerState(state: PromoBannerState) {
  if (typeof document === "undefined") return;
  if (state === "hidden") {
    delete document.documentElement.dataset.promoBanner;
  } else {
    document.documentElement.dataset.promoBanner = state;
  }
}

function normalizeMobile(value: string) {
  return value.replace(/\D/g, "");
}

const EXCLUDED_PREFIXES = ["/mgmt", "/superadmin", "/staff", "/checkout", "/auth"];

export function BlitzAuditBanner() {
  const [slots, setSlots] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const pathname = usePathname();

  useEffect(() => {
    setDismissed(readDismissed());
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSlots = async () => {
      try {
        const response = await fetch("/api/free-installation-slots", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && typeof data?.remainingSlots === "number") {
          setSlots(data.remainingSlots);
        }
      } catch {
        if (!cancelled) setSlots(10);
      }
    };
    void loadSlots();
    return () => {
      cancelled = true;
    };
  }, []);

  const isExcluded = EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  const slotsDisplay = slots ?? "—";
  const isVisible = hydrated && !dismissed && step !== "success" && !isExcluded && slots !== 0;

  useEffect(() => {
    if (!isVisible) {
      syncPromoBannerState("hidden");
      return undefined;
    }

    const bannerState: PromoBannerState = expanded ? "expanded" : "collapsed";
    syncPromoBannerState(bannerState);

    return () => syncPromoBannerState("hidden");
  }, [isVisible, expanded]);

  const handleDismiss = () => {
    dismissForSession();
    setDismissed(true);
    setExpanded(false);
    syncPromoBannerState("hidden");
  };

  const handleRequestOtp = async () => {
    const mobile = normalizeMobile(phone);
    if (mobile.length < 10) {
      toast({ variant: "destructive", title: "Invalid Phone Number" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, type: "signup" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to send OTP");
      }
      if (!data?.otpId) {
        throw new Error("OTP reference missing. Please try again.");
      }
      setOtpId(String(data.otpId));
      setStep("otp");
      setExpanded(true);
      toast({ title: "OTP Sent", description: "Check your messages." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "OTP Failed",
        description: error instanceof Error ? error.message : "Could not send OTP.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndClaim = async () => {
    const mobile = normalizeMobile(phone);
    if (!/^\d{6}$/.test(otp)) {
      toast({ variant: "destructive", title: "Invalid OTP", description: "Enter the 6-digit code." });
      return;
    }
    if (!otpId) {
      toast({ variant: "destructive", title: "Session expired", description: "Please request a new OTP." });
      setStep("phone");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/promotions/free-installation-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp, otpId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Could not claim offer");
      }
      setStep("success");
      syncPromoBannerState("hidden");
      toast({
        title: "Offer Claimed",
        description: "Our team will contact you to verify your free installation.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-primary/50 bg-card/95 text-foreground backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(37,99,235,0.4)] animate-slide-up pb-[env(safe-area-inset-bottom,0px)] font-sans transition-all duration-500"
      role="region"
      aria-label="Free installation offer"
    >
      <div className={`px-3 py-2.5 lg:hidden ${expanded ? "hidden" : "block"}`}>
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <p className="min-w-0 flex-1 text-sm font-black leading-snug sm:text-base font-tech tracking-wide">
            <span className="mr-1 text-primary animate-pulse">⚡</span>
            Free Installation —{" "}
            <span className="whitespace-nowrap">
              <span className="rounded-md bg-primary/20 border border-primary/40 px-2 py-0.5 font-black text-primary">{slotsDisplay}</span> slots left
            </span>
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="shrink-0 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 text-xs font-black tracking-wider sm:text-sm transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"
          >
            Claim
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            aria-label="Expand offer details"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            aria-label="Dismiss offer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={`p-3 sm:p-4 ${expanded ? "block" : "hidden lg:block"}`}>
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start justify-between gap-3 lg:block">
            <div className="min-w-0">
              <h3 className="text-lg font-black sm:text-2xl flex items-center gap-2 font-tech tracking-wider text-foreground">
                <span className="text-primary animate-pulse drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]">⚡</span> MONTHLY FREE INSTALLATION OFFER
              </h3>
              <p className="mt-1 text-sm font-semibold sm:text-base text-muted-foreground tracking-wide">
                First 10 confirmed orders get 100% Free Installation. Only{" "}
                <span className="rounded-lg bg-primary/20 border border-primary/40 px-2.5 py-1 font-black text-xl text-primary drop-shadow-[0_0_10px_rgba(37,99,235,0.5)]">{slotsDisplay}</span> slots
                remaining this month!
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 lg:hidden">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                aria-label="Collapse offer"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                aria-label="Dismiss offer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:items-center">
            {step === "phone" ? (
              <>
                  <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Enter Mobile for OTP"
                  className="w-full rounded-xl bg-background border border-border px-5 py-4 font-bold text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:py-3 lg:w-72 shadow-inner"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={submitting}
                  className="whitespace-nowrap rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 font-black tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] disabled:opacity-60 sm:py-3"
                >
                  {submitting ? "SENDING..." : "CLAIM SLOT NOW"}
                </button>
              </>
            ) : (
              <>
                  <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter OTP"
                  className="w-full rounded-xl bg-background border border-border px-5 py-4 text-center font-black tracking-[0.5em] text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:py-3 lg:w-64 shadow-inner"
                  value={otp}
                  maxLength={6}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                />
                <button
                  type="button"
                  onClick={handleVerifyAndClaim}
                  disabled={submitting}
                  className="whitespace-nowrap rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 font-black tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] disabled:opacity-60 sm:py-3"
                >
                  {submitting ? "VERIFYING..." : "VERIFY & DISPATCH"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors lg:flex ml-4"
              aria-label="Dismiss offer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
