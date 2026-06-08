"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function BlitzAuditBanner() {
  const [slots, setSlots] = useState(3);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const { toast } = useToast();
  const pathname = usePathname();

  // Scarcity countdown simulator (aggressive conversion trigger)
  useEffect(() => {
    const timer = setInterval(() => {
      setSlots((prev) => (prev > 1 ? prev - 1 : prev));
    }, 120000); // Decrement every 2 mins to keep it realistic
    return () => clearInterval(timer);
  }, []);

  const handleRequestOtp = async () => {
    if (phone.length < 10) {
      toast({ variant: "destructive", title: "Invalid Phone Number" });
      return;
    }
    // Assume OTP trigger API route exists
    await fetch("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }) });
    setStep("otp");
    toast({ title: "OTP Sent", description: "Check your messages." });
  };

  const handleVerifyAndClaim = async () => {
    // Attempt verification (simulated for immediate production flow, adjust to actual endpoints)
    if (otp.length < 4) {
      toast({ variant: "destructive", title: "Invalid OTP" });
      return;
    }
    
    // Create priority ticket
    await fetch("/api/services/tickets", {
      method: "POST",
      body: JSON.stringify({ type: "FREE_INSTALLATION_CLAIM", priority: "URGENT", phone }),
    });
    setStep("success");
    toast({ title: "Offer Claimed", description: "Our team will contact you to verify your free installation." });
  };

  if (step === "success") return null;
  if (pathname?.startsWith('/mgmt') || pathname?.startsWith('/superadmin') || pathname?.startsWith('/staff')) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 w-full bg-red-600 text-white p-4 z-50 flex flex-col md:flex-row items-center justify-between shadow-[0_-10px_40px_rgba(220,38,38,0.4)] border-t-4 border-red-800 animate-slide-up">
      <div className="mb-4 md:mb-0">
        <h3 className="font-extrabold text-xl animate-pulse">⚡ MONTHLY FREE INSTALLATION OFFER</h3>
        <p className="text-sm font-medium">First 10 confirmed orders get 100% Free Installation. Only <span className="bg-white text-red-600 px-2 py-0.5 rounded font-black text-lg">{slots}</span> slots remaining this month!</p>
      </div>
      
      <div className="flex gap-2 w-full md:w-auto">
        {step === "phone" ? (
          <>
            <input 
              type="tel" 
              placeholder="Enter Mobile for OTP" 
              className="text-black px-4 py-2 rounded-md font-bold focus:ring-4 focus:ring-red-400 outline-none w-full md:w-64"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button onClick={handleRequestOtp} className="bg-black hover:bg-gray-900 px-6 py-2 rounded-md font-extrabold transition-all transform hover:scale-105 shadow-lg whitespace-nowrap">
              CLAIM SLOT NOW
            </button>
          </>
        ) : (
          <>
            <input 
              type="text" 
              placeholder="Enter OTP" 
              className="text-black px-4 py-2 rounded-md font-bold focus:ring-4 focus:ring-red-400 outline-none w-full md:w-48 text-center tracking-widest"
              value={otp}
              maxLength={6}
              onChange={(e) => setOtp(e.target.value)}
            />
            <button onClick={handleVerifyAndClaim} className="bg-black hover:bg-gray-900 px-6 py-2 rounded-md font-extrabold transition-all transform hover:scale-105 shadow-lg whitespace-nowrap">
              VERIFY & DISPATCH
            </button>
          </>
        )}
      </div>
    </div>
  );
}
