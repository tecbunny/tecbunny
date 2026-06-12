'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useLeadCaptureTrigger(delayMs: number = 45000) {
  const [hasTriggered, setHasTriggered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const resetTimer = () => {
    if (hasTriggered) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      triggerLeadCapture();
    }, delayMs);
  };

  const triggerLeadCapture = () => {
    setHasTriggered(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('tecbunny:lead-capture-seen', '1');
    }
    toast({
      title: "Need Expert Assistance?",
      description: "You've been exploring for a while! Get an instant personalized consultation or a limited-time hardware bundle voucher now.",
      action: (
        <button
          onClick={() => window.open('https://wa.me/919604136010?text=Hi!%20I%20need%20help%20with%20my%20customised%20setup.', '_blank')}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Chat on WhatsApp
        </button>
      ),
      duration: 10000,
    });
  };

  useEffect(() => {
    const alreadySeen = typeof window !== 'undefined' && window.sessionStorage.getItem('tecbunny:lead-capture-seen') === '1';
    if (alreadySeen) {
      setHasTriggered(true);
      return;
    }

    // Start timer on mount
    resetTimer();

    // Reset timer on user activity
    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activities.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activities.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [hasTriggered]);

  return { hasTriggered };
}
