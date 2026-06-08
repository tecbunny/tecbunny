'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MapPin, ShieldCheck, Activity, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Dynamic hyper-local rotation data for North Goa
const RECENT_ACTIONS = [
  { action: "Corporate infrastructure setup deployed", area: "Porvorim Tech Hub", time: "12 mins ago" },
  { action: "Security grid audit cleared", area: "Mapusa Industrial Estate", time: "28 mins ago" },
  { action: "POS Terminal network upgraded", area: "Calangute Beach Road", time: "41 mins ago" },
  { action: "Cloud migration SLA locked", area: "Panjim Patto Centre", time: "1 hr ago" },
];

interface RegionalTrustBannerProps {
  className?: string;
}

export const RegionalTrustBanner = ({ className }: RegionalTrustBannerProps) => {
  const [region, setRegion] = useState<string>('North Goa');
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsVisible(true);
    
    // Initial delay before showing the first popup
    const startDelay = setTimeout(() => setShowPopup(true), 3000);

    const interval = setInterval(() => {
      setShowPopup(false); // Trigger exit animation
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % RECENT_ACTIONS.length);
        setShowPopup(true); // Trigger enter animation
      }, 500); // Wait for exit animation to complete
    }, 8000); // Rotate every 8 seconds

    return () => {
      clearTimeout(startDelay);
      clearInterval(interval);
    };
  }, []);

  if (!isVisible) return null;
  if (pathname?.startsWith('/mgmt') || pathname?.startsWith('/superadmin') || pathname?.startsWith('/staff')) {
    return null;
  }

  const currentAction = RECENT_ACTIONS[currentIndex];

  return (
    <>
      <div className={cn(
        "relative overflow-hidden bg-slate-900/40 border-y border-white/5 py-3 px-4",
        className
      )}>
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              Serving verified B2B surveillance layouts across <span className="text-emerald-400 font-bold">{region}</span> with live SLA clearance.
            </p>
          </div>
          
          <div className="flex items-center gap-6 text-xs text-slate-400 uppercase tracking-widest font-semibold">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>99.9% Uptime SLA</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-blue-400" />
              <span>Real-time Monitoring</span>
            </div>
          </div>
        </div>
        
        {/* Background Decorative Mesh */}
        <div className="absolute top-0 right-0 -z-10 h-full w-1/3 bg-gradient-to-l from-emerald-500/5 to-transparent blur-3xl" />
      </div>

      {/* Floating Real-Time Proximity Popup */}
      <div
        className={`fixed bottom-24 left-4 md:bottom-24 md:left-6 z-[60] transition-all duration-500 ease-in-out transform ${
          showPopup ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-white/95 backdrop-blur-md border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl p-3 flex items-center gap-3 w-[320px]">
          <div className="bg-green-100 p-2 rounded-full flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-gray-900 leading-tight">
              {currentAction.action}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-semibold text-blue-600">
                📍 {currentAction.area}
              </span>
              <span className="text-[10px] text-gray-400 font-medium">
                • {currentAction.time}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
