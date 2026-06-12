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
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
        
        <button 
          onClick={handleDismiss}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-bold text-foreground leading-none">Exclusive Reward</h4>
            <p className="text-[10px] text-primary uppercase tracking-widest mt-1">Wishlist Loyalty Bonus</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          We noticed you've been eyeing some great tech! Complete your first order today with this special code.
        </p>

        <div className="group relative mb-6">
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary to-primary/80 opacity-20 blur group-hover:opacity-40 transition duration-500" />
          <div className="relative flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <span className="font-mono text-lg font-bold text-foreground tracking-tighter">{coupon.code}</span>
            </div>
            <button 
              onClick={copyCode}
              className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-foreground transition-colors"
            >
              Copy Code
            </button>
          </div>
        </div>

        <Button 
          className="w-full h-12 bg-primary hover:bg-primary/90 text-white gap-2 font-bold"
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
