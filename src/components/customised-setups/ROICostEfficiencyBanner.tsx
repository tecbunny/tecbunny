'use client';

import React from 'react';
import { TrendingDown, ShieldCheck, Zap } from 'lucide-react';

interface ROICostEfficiencyBannerProps {
  savingsPercentage?: number;
  isTech?: boolean;
}

export function ROICostEfficiencyBanner({ savingsPercentage = 35, isTech = true }: ROICostEfficiencyBannerProps) {
  return (
    <div className={`mt-6 overflow-hidden rounded-2xl border ${isTech ? 'border-primary/20 bg-primary/5' : 'border-blue-100 bg-blue-50'} p-5 transition-all hover:shadow-lg hover:shadow-primary/5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isTech ? 'bg-primary/20 text-primary' : 'bg-blue-600 text-white'}`}>
          <TrendingDown className="h-6 w-6" />
        </div>
        
        <div className="flex-1">
          <h3 className={`text-lg font-bold ${isTech ? 'text-foreground' : 'text-slate-900'}`}>
            Precision Engineering, Maximum Value
          </h3>
          <p className={`mt-1 text-sm leading-relaxed ${isTech ? 'text-muted-foreground' : 'text-slate-600'}`}>
            This configuration is optimized for 24/7 reliability with a projected <span className="font-bold text-primary">{savingsPercentage}% reduction in TCO</span> (Total Cost of Ownership) over 3 years compared to off-the-shelf retail bundles.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-col lg:flex-row">
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 backdrop-blur-sm border border-border">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Industrial Grade</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 backdrop-blur-sm border border-border">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Seamless Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}
