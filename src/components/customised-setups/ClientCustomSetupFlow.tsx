'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

const CustomSetupFlow = dynamic(
  () => import('./CustomSetupFlow'),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 w-full rounded-2xl border border-white/5 bg-slate-900/40 animate-pulse flex items-center justify-center">
        <span className="text-sm text-slate-400">Loading configurator modules...</span>
      </div>
    ),
  }
);

export default CustomSetupFlow;
