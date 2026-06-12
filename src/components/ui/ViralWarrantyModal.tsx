"use client";

import { useState } from "react";

export function ViralWarrantyModal({ phone, serialNumber }: { phone: string; serialNumber: string }) {
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleViralShare = async () => {
    const text = encodeURIComponent(
      `I just secured my corporate infrastructure with TecBunny. 100% verified setup.\n\nCheck them out: https://tecbunny.com?ref=${serialNumber}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/promotions/claim-viral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, serialNumber, action: "WHATSAPP_SHARE" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Could not unlock credit");
      }
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock credit");
    } finally {
      setSubmitting(false);
    }
  };

  if (claimed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm animate-in fade-in duration-500 p-4">
        <div className="bg-card border border-border p-8 rounded-xl text-center max-w-md w-full shadow-2xl">
          <h2 className="text-2xl font-black text-primary mb-2">₹500 CREDIT UNLOCKED</h2>
          <p className="text-muted-foreground font-mono text-sm">Coupon Code: TB-VRL-{serialNumber.substring(0, 4)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm animate-in zoom-in-95 duration-500 p-4">
      <div className="bg-card border border-border p-6 sm:p-8 rounded-xl max-w-md w-full shadow-2xl">
        <div className="inline-block bg-primary/10 text-primary px-3 py-1 font-black text-xs tracking-widest rounded-full mb-4">
          ACTION REQUIRED
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-4 leading-tight">
          Claim Your ₹500 System Upgrade Credit
        </h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Your hardware is secured. Share your verified setup status with your network to instantly unlock ₹500
          towards your next security grid addition.
        </p>
        {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
        <button
          onClick={handleViralShare}
          disabled={submitting}
          className="w-full bg-[#25D366] hover:bg-[#1ebd5a] disabled:opacity-60 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] min-h-[48px]"
        >
          {submitting ? "UNLOCKING..." : "SHARE TO UNLOCK VIA WHATSAPP"}
        </button>
      </div>
    </div>
  );
}
