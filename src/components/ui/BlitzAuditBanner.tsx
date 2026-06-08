"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export function BlitzAuditBanner() {
  const [slots, setSlots] = useState(47);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const { toast } = useToast();

  // Scarcity countdown simulator (aggressive conversion trigger)
  useEffect(() => {
    const timer = setInterval(() => {
      setSlots((prev) => (prev > 12 ? prev - Math.floor(Math.random() * 2) : prev));
    }, 45000);
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
      body: JSON.stringify({ type: "INFRA_AUDIT", priority: "URGENT", phone, location: "North Goa" }),
    });
    setStep("success");
    toast({ title: "Audit Secured", description: "A North Goa engineer will contact you in 15 minutes." });
  };

  if (step === "success") return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-red-600 text-white p-4 z-50 flex flex-col md:flex-row items-center justify-between shadow-[0_-10px_40px_rgba(220,38,38,0.4)] border-t-4 border-red-800 animate-slide-up">
      <div className="mb-4 md:mb-0">
        <h3 className="font-extrabold text-xl animate-pulse">⚡ NORTH GOA INFRASTRUCTURE BLITZ</h3>
        <p className="text-sm font-medium">Only <span className="bg-white text-red-600 px-2 py-0.5 rounded font-black text-lg">{slots}</span> Free Enterprise Technical Audits Remaining Today.</p>
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
