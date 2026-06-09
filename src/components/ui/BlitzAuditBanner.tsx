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
  // Hide for the rest of this browser session (tab lifetime).
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

const EXCLUDED_PREFIXES = ["/mgmt", "/superadmin", "/staff", "/checkout", "/auth"];

export function BlitzAuditBanner() {
  const [slots, setSlots] = useState(3);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { toast } = useToast();
  const pathname = usePathname();

  useEffect(() => {
    setDismissed(readDismissed());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlots((prev) => (prev > 1 ? prev - 1 : prev));
    }, 120000);
    return () => clearInterval(timer);
  }, []);

  const isExcluded = EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  const isVisible = hydrated && !dismissed && step !== "success" && !isExcluded;

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
    if (phone.length < 10) {
      toast({ variant: "destructive", title: "Invalid Phone Number" });
      return;
    }
    await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setStep("otp");
    setExpanded(true);
    toast({ title: "OTP Sent", description: "Check your messages." });
  };

  const handleVerifyAndClaim = async () => {
    if (otp.length < 4) {
      toast({ variant: "destructive", title: "Invalid OTP" });
      return;
    }

    await fetch("/api/services/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "FREE_INSTALLATION_CLAIM", priority: "URGENT", phone }),
    });
    setStep("success");
    syncPromoBannerState("hidden");
    toast({
      title: "Offer Claimed",
      description: "Our team will contact you to verify your free installation.",
    });
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t-4 border-red-800 bg-red-600 text-white shadow-[0_-10px_40px_rgba(220,38,38,0.4)] animate-slide-up pb-[env(safe-area-inset-bottom,0px)]"
      role="region"
      aria-label="Free installation offer"
    >
      {/* Mobile + tablet: collapsed strip */}
      <div className={`px-3 py-2.5 lg:hidden ${expanded ? "hidden" : "block"}`}>
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <p className="min-w-0 flex-1 text-xs font-bold leading-snug sm:text-sm">
            <span className="mr-1">⚡</span>
            Free Installation —{" "}
            <span className="whitespace-nowrap">
              <span className="rounded bg-white px-1.5 py-0.5 font-black text-red-600">{slots}</span> slots left
            </span>
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="shrink-0 rounded-md bg-black px-3 py-2 text-xs font-extrabold sm:text-sm"
          >
            Claim
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/20 bg-black/30"
            aria-label="Expand offer details"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/20 bg-black/30"
            aria-label="Dismiss offer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile expanded + desktop full layout */}
      <div
        className={`p-3 sm:p-4 ${expanded ? "block" : "hidden lg:block"}`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start justify-between gap-3 lg:block">
            <div className="min-w-0">
              <h3 className="text-base font-extrabold sm:text-xl">⚡ MONTHLY FREE INSTALLATION OFFER</h3>
              <p className="mt-1 text-xs font-medium sm:text-sm">
                First 10 confirmed orders get 100% Free Installation. Only{" "}
                <span className="rounded bg-white px-2 py-0.5 font-black text-lg text-red-600">{slots}</span> slots
                remaining this month!
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 lg:hidden">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-white/20 bg-black/30"
                aria-label="Collapse offer"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-white/20 bg-black/30"
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
                  className="w-full rounded-md px-4 py-3 font-bold text-black outline-none focus:ring-4 focus:ring-red-400 sm:py-2 lg:w-64"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  className="whitespace-nowrap rounded-md bg-black px-6 py-3 font-extrabold shadow-lg transition-colors hover:bg-gray-900 sm:py-2"
                >
                  CLAIM SLOT NOW
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter OTP"
                  className="w-full rounded-md px-4 py-3 text-center font-bold tracking-widest text-black outline-none focus:ring-4 focus:ring-red-400 sm:py-2 lg:w-48"
                  value={otp}
                  maxLength={6}
                  onChange={(e) => setOtp(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleVerifyAndClaim}
                  className="whitespace-nowrap rounded-md bg-black px-6 py-3 font-extrabold shadow-lg transition-colors hover:bg-gray-900 sm:py-2"
                >
                  VERIFY & DISPATCH
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/20 bg-black/30 lg:flex"
              aria-label="Dismiss offer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
