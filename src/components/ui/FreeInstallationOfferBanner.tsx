'use client';

import { useEffect, useState } from 'react';
import { Zap, Check, Loader } from 'lucide-react';
import { Badge } from './badge';

interface FreeInstallationOfferBannerProps {
  installationPrice?: number;
  isEligible?: boolean;
  variant?: 'inline' | 'card';
}

export function FreeInstallationOfferBanner({
  installationPrice = 0,
  isEligible = true,
  variant = 'inline'
}: FreeInstallationOfferBannerProps) {
  const [slotsRemaining, setSlotsRemaining] = useState<number | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const maxFreeInstallationValue = 2499;
  const isFreeEligible = isEligible && installationPrice > 0 && installationPrice <= maxFreeInstallationValue;

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/free-installation-slots');
        const data = await response.json();
        
        if (data.success) {
          setSlotsRemaining(data.remainingSlots);
          setConfirmedCount(data.confirmedCount);
        } else {
          // Fallback to default value
          setSlotsRemaining(10);
        }
      } catch (error) {
        console.error('Error fetching free installation slots:', error);
        setSlotsRemaining(10); // Fallback
      } finally {
        setIsLoading(false);
      }
    };

    fetchSlots();

    // Refresh every 5 minutes to show updated slot count
    const interval = setInterval(fetchSlots, 300000);

    return () => clearInterval(interval);
  }, []);

  if (variant === 'card') {
    return (
      <div className={`rounded-lg border p-4 ${
        isFreeEligible 
          ? 'border-emerald-500/30 bg-emerald-500/10' 
          : 'border-slate-500/30 bg-slate-500/10'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`mt-1 ${isFreeEligible ? 'text-emerald-400' : 'text-slate-400'}`}>
            {isFreeEligible ? <Check className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">
              {isFreeEligible ? '✓ Free Installation Eligible' : 'Installation Offer'}
            </p>
            <p className={`text-sm mt-1 ${isFreeEligible ? 'text-emerald-200' : 'text-slate-300'}`}>
              {isFreeEligible ? (
                <>
                  Your installation (₹{Math.round(installationPrice).toLocaleString()}) qualifies for our <strong>FREE installation offer</strong> (up to ₹2,499/-). 
                  <strong className="ml-1">
                    {isLoading ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader className="h-3 w-3 animate-spin" /> Loading...
                      </span>
                    ) : (
                      <>{slotsRemaining} confirmed installations so far this month</>
                    )}
                  </strong>
                </>
              ) : (
                <>
                  Free installation available for setups up to ₹2,499/-. Your installation: ₹{Math.round(installationPrice).toLocaleString()}
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between rounded-md p-3 text-sm ${
      isFreeEligible 
        ? 'border border-emerald-500/30 bg-emerald-500/10' 
        : 'border border-slate-500/30 bg-slate-500/10'
    }`}>
      <div className="flex items-center gap-2">
        {isFreeEligible ? (
          <>
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-emerald-200">
              <strong>Free Installation</strong> • {isLoading ? 'Loading...' : `${slotsRemaining} confirmed`}
            </span>
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 text-slate-400" />
            <span className="text-slate-300">
              Free installation up to ₹2,499/- • Your setup: ₹{Math.round(installationPrice).toLocaleString()}
            </span>
          </>
        )}
      </div>
      {isFreeEligible && !isLoading && (
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">OFFER ACTIVE</Badge>
      )}
    </div>
  );
}
