"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ViralWarrantyModal } from "@/components/ui/ViralWarrantyModal";

export default function WarrantyActivationPage() {
  const params = useParams();
  const serialNumber = params.serialNumber as string;

  const [step, setStep] = useState<"init" | "phone" | "otp" | "activated">("init");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [deviceDetails, setDeviceDetails] = useState<{ type: string; model: string } | null>(null);

  useEffect(() => {
    setDeviceDetails({ type: "IP_CAMERA", model: "SEC-PRO-9000" });
  }, [serialNumber]);

  const handleRequestOtp = async () => {
    if (phone.length < 10) return;
    await fetch("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }) });
    setStep("otp");
  };

  const handleVerifyAndActivate = async () => {
    if (otp.length < 4) return;
    await fetch("/api/admin/inventory/warranty/register", {
      method: "POST",
      body: JSON.stringify({ serialNumber, phone, deviceType: deviceDetails?.type }),
    });
    setStep("activated");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-green-500 font-mono p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl border border-green-800 bg-black p-6 rounded-sm shadow-[0_0_20px_rgba(34,197,94,0.1)]">
        <div className="flex items-center justify-between border-b border-green-900 pb-4 mb-6">
          <span className="text-xs tracking-widest uppercase">TecBunny Secure Terminal</span>
          <span className="text-xs text-green-700">SYS.AUTH.v9</span>
        </div>

        <div className="space-y-4">
          <p>{`> INITIALIZING HARDWARE VERIFICATION...`}</p>
          <p>{`> SERIAL DETECTED: ${serialNumber}`}</p>
          {deviceDetails && <p>{`> DEVICE MATCH: ${deviceDetails.model} [${deviceDetails.type}]`}</p>}
          
          {step === "init" && (
            <button onClick={() => setStep("phone")} className="mt-6 bg-green-900/30 border border-green-500 text-green-400 hover:bg-green-500 hover:text-black px-6 py-2 transition-all uppercase tracking-wider text-sm font-bold">
              Authenticate & Unlock Warranty
            </button>
          )}

          {step === "phone" && (
            <div className="mt-4 flex gap-3 animate-in fade-in zoom-in duration-300">
              <span className="py-2">{`> ENTER MOBILE:`}</span>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="bg-transparent border-b border-green-500 text-green-400 focus:outline-none focus:border-green-300 px-2 w-48" />
              <button onClick={handleRequestOtp} className="bg-green-500 text-black px-4 py-1 hover:bg-green-400 font-bold">TRANSMIT</button>
            </div>
          )}

          {step === "otp" && (
            <div className="mt-4 flex gap-3 animate-in fade-in zoom-in duration-300">
              <span className="py-2">{`> ENTER OTP:`}</span>
              <input type="text" value={otp} onChange={e => setOtp(e.target.value)} className="bg-transparent border-b border-green-500 text-green-400 focus:outline-none focus:border-green-300 px-2 w-32 tracking-widest" />
              <button onClick={handleVerifyAndActivate} className="bg-green-500 text-black px-4 py-1 hover:bg-green-400 font-bold">VERIFY</button>
            </div>
          )}

          {step === "activated" && (
            <div className="mt-6 text-green-400">
              <p>{`> AUTHENTICATION SUCCESSFUL`}</p>
              <p>{`> WARRANTY CERTIFICATE GENERATED`}</p>
              <p className="animate-pulse mt-4 text-emerald-300">{`> INITIATING SECURE HANDSHAKE...`}</p>
            </div>
          )}
        </div>
      </div>
      
      {step === "activated" && <ViralWarrantyModal phone={phone} serialNumber={serialNumber} />}
    </div>
  );
}