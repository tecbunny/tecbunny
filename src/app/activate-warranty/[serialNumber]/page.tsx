"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ViralWarrantyModal } from "@/components/ui/ViralWarrantyModal";

function normalizeMobile(value: string) {
  return value.replace(/\D/g, "");
}

export default function WarrantyActivationPage() {
  const params = useParams();
  const serialNumber = params.serialNumber as string;

  const [step, setStep] = useState<"init" | "phone" | "otp" | "activated">("init");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceDetails, setDeviceDetails] = useState<{ type: string; model: string } | null>(null);

  useEffect(() => {
    setDeviceDetails({ type: "DEFAULT", model: serialNumber });
  }, [serialNumber]);

  const handleRequestOtp = async () => {
    const mobile = normalizeMobile(phone);
    if (mobile.length < 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setSubmitting(true);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndActivate = async () => {
    const mobile = normalizeMobile(phone);
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    if (!otpId) {
      setError("Session expired. Request a new OTP.");
      setStep("phone");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/warranty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber, mobile, otp, otpId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Activation failed");
      }
      if (data?.device) {
        setDeviceDetails(data.device);
      }
      setStep("activated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl border border-border bg-card p-6 rounded-lg shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
          <span className="text-xs tracking-widest uppercase">TecBunny Secure Terminal</span>
          <span className="text-xs text-muted-foreground">SYS.AUTH.v9</span>
        </div>

        <div className="space-y-4">
          <p>{`> INITIALIZING HARDWARE VERIFICATION...`}</p>
          <p>{`> SERIAL DETECTED: ${serialNumber}`}</p>
          {deviceDetails && (
            <p>{`> DEVICE MATCH: ${deviceDetails.model} [${deviceDetails.type}]`}</p>
          )}

          {error && <p className="text-rose-500">{`> ERROR: ${error}`}</p>}

          {step === "init" && (
            <button
              onClick={() => setStep("phone")}
              className="mt-6 bg-primary/10 border border-primary text-primary hover:bg-primary hover:text-primary-foreground px-6 py-2 transition-all uppercase tracking-wider text-sm font-bold rounded-md"
            >
              Authenticate & Unlock Warranty
            </button>
          )}

          {step === "phone" && (
            <div className="mt-4 flex flex-wrap gap-3 items-center animate-in fade-in zoom-in duration-300">
              <span className="py-2">{`> ENTER MOBILE:`}</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-transparent border-b border-primary text-foreground focus:outline-none focus:border-primary/80 px-2 w-48 min-h-[44px]"
              />
              <button
                onClick={handleRequestOtp}
                disabled={submitting}
                className="bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90 font-bold min-h-[44px] disabled:opacity-60 rounded-md"
              >
                {submitting ? "SENDING..." : "TRANSMIT"}
              </button>
            </div>
          )}

          {step === "otp" && (
            <div className="mt-4 flex flex-wrap gap-3 items-center animate-in fade-in zoom-in duration-300">
              <span className="py-2">{`> ENTER OTP:`}</span>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                maxLength={6}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="bg-transparent border-b border-primary text-foreground focus:outline-none focus:border-primary/80 px-2 w-32 tracking-widest min-h-[44px]"
              />
              <button
                onClick={handleVerifyAndActivate}
                disabled={submitting}
                className="bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90 font-bold min-h-[44px] disabled:opacity-60 rounded-md"
              >
                {submitting ? "VERIFYING..." : "VERIFY"}
              </button>
            </div>
          )}

          {step === "activated" && (
            <div className="mt-6 text-primary">
              <p>{`> AUTHENTICATION SUCCESSFUL`}</p>
              <p>{`> WARRANTY CERTIFICATE GENERATED`}</p>
              <p className="animate-pulse mt-4 text-primary font-bold">{`> INITIATING SECURE HANDSHAKE...`}</p>
            </div>
          )}
        </div>
      </div>

      {step === "activated" && <ViralWarrantyModal phone={phone} serialNumber={serialNumber} />}
    </div>
  );
}
