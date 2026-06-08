'use client';

import React, { useState } from 'react';
import { Sparkles, Copy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReferralWidget({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const referralLink = "https://tecbunny.com/invite/bus-291x";

  // Pre-written high-conversion WhatsApp copy
  const waCopy = `Hey! I started using this app called Tecbunny for my tech service billing. It makes invoices in 30 seconds and tracks who owes me money. Check it out here: ${referralLink}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waCopy)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-100 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6", className)}>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-amber-500" /> 
          Unlock Premium Invoice Templates
        </h3>
        <p className="text-slate-600 text-sm max-w-lg leading-relaxed">
          Know another business owner? Send them your link. When they create their first invoice, you both unlock Premium Templates and Auto-Payment Reminders.
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <a 
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-6 py-2.5 rounded-lg font-medium shadow-sm shadow-[#25D366]/20 transition-all active:scale-95"
        >
          {/* Custom SVG for WhatsApp since Lucide doesn't have brand icons */}
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          Share on WhatsApp
        </a>
        <button 
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 px-6 py-2.5 text-blue-600 font-medium bg-white hover:bg-blue-50 border border-blue-100 rounded-lg transition-colors"
        >
          {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}
