'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Tag, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks';
import { createClient } from '@/lib/supabase/client';
import { Button } from './ui/button';

export function BehavioralCouponPopup() {
  const { user } = useAuth();
  const [coupon, setCoupon] = useState<{ code: string; reason: string } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!user || isDismissed) return;

    let timer: NodeJS.Timeout;

    const fetchMarketingMeta = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('marketing_metadata')
        .eq('id', user.id)
        .single();

      if (!error && data?.marketing_metadata?.suggested_coupon) {
        const suggested = data.marketing_metadata.suggested_coupon;
        setCoupon(suggested);
        
        // Show after a short delay for impact
        timer = setTimeout(() => setIsVisible(true), 3000);
      }
    };

    fetchMarketingMeta();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [user, isDismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    // Optionally update DB to mark as seen
  };

  const copyCode = () => {
    if (coupon) {
      navigator.clipboard.writeText(coupon.code);
      // Change text briefly
    }
  };

  if (!isVisible || !coupon) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl shadow-cyan-500/20 backdrop-blur-xl">
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />
        
        <button 
          onClick={handleDismiss}
          className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-bold text-white leading-none">Exclusive Reward</h4>
            <p className="text-[10px] text-cyan-400 uppercase tracking-widest mt-1">Wishlist Loyalty Bonus</p>
          </div>
        </div>

        <p className="text-sm text-slate-400 mb-6">
          We noticed you've been eyeing some great tech! Complete your first order today with this special code.
        </p>

        <div className="group relative mb-6">
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 opacity-20 blur group-hover:opacity-40 transition duration-500" />
          <div className="relative flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-lg font-bold text-white tracking-tighter">{coupon.code}</span>
            </div>
            <button 
              onClick={copyCode}
              className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 hover:text-white transition-colors"
            >
              Copy Code
            </button>
          </div>
        </div>

        <Button 
          className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-bold"
          onClick={() => {
            window.location.href = '/products';
          }}
        >
          Shop Now <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
