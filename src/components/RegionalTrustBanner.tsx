'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, ShieldCheck, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegionalTrustBannerProps {
  className?: string;
}

export const RegionalTrustBanner = ({ className }: RegionalTrustBannerProps) => {
  const [region, setRegion] = useState<string>('India');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Attempt regional detection via client-side metadata or IP-based API
    // Fallback to generalized high-trust state if detection is blocked
    const detectRegion = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.region) {
          setRegion(data.region);
        }
      } catch (e) {
        // Fallback silently
      } finally {
        setIsVisible(true);
      }
    };

    detectRegion();
  }, []);

  if (!isVisible) return null;

  return (
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
  );
};
