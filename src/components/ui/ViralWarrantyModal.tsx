"use client";

import { useState } from "react";

export function ViralWarrantyModal({ phone, serialNumber }: { phone: string; serialNumber: string }) {
  const [claimed, setClaimed] = useState(false);

  const handleViralShare = async () => {
    const text = encodeURIComponent(`I just secured my corporate infrastructure with TecBunny. 100% verified setup.\n\nCheck them out: https://tecbunny.com?ref=${serialNumber}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");

    await fetch("/api/promotions/claim-viral", {
      method: "POST",
      body: JSON.stringify({ phone, serialNumber, action: "WHATSAPP_SHARE" })
    });
    
    setClaimed(true);
  };

  if (claimed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-500">
        <div className="bg-slate-900 border border-green-500 p-8 rounded-xl text-center max-w-md">
          <h2 className="text-2xl font-black text-green-400 mb-2">₹500 CREDIT UNLOCKED</h2>
          <p className="text-green-600 font-mono text-sm">Coupon Code: TB-VRL-{serialNumber.substring(0,4)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm animate-in zoom-in-95 duration-500">
      <div className="bg-slate-900 border border-green-500 p-8 rounded-xl max-w-md shadow-[0_0_50px_rgba(34,197,94,0.2)]">
        <div className="inline-block bg-green-500 text-black px-3 py-1 font-black text-xs tracking-widest rounded-full mb-4">
          ACTION REQUIRED
        </div>
        <h2 className="text-3xl font-black text-white mb-4 leading-tight">Claim Your ₹500 System Upgrade Credit</h2>
        <p className="text-slate-400 mb-6 text-sm">
          Your hardware is secured. Share your verified setup status with your network to instantly unlock ₹500 towards your next security grid addition.
        </p>
        <button 
          onClick={handleViralShare}
          className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 rounded-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
        >
          SHARE TO UNLOCK VIA WHATSAPP
        </button>
      </div>
    </div>
  );
}