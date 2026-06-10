"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function QuotationStatusLookup() {
  const router = useRouter();
  const [quoteNumberInput, setQuoteNumberInput] = React.useState('');
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [lookupError, setLookupError] = React.useState('');

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = quoteNumberInput.trim();
    if (!inputVal) return;
    
    setLookupLoading(true);
    setLookupError('');
    
    fetch(`/api/quotes/${inputVal}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Quote not found');
        }
        router.push(`/quotes/${inputVal}`);
      })
      .catch(() => {
        setLookupError('Invalid quote number or quote not found.');
        setLookupLoading(false);
      });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-cyan-200 font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              Check Quotation Status
            </p>
            <p className="text-xs text-slate-400">Track revisions, approval, or proceed with payment.</p>
          </div>
        </div>
        <form onSubmit={handleLookupSubmit} className="space-y-3 mt-4">
          <div className="space-y-1">
            <Label htmlFor="lookup-quote-number">Quote Number or ID</Label>
            <div className="flex gap-2">
              <Input
                id="lookup-quote-number"
                type="text"
                placeholder="e.g. 20260600001"
                value={quoteNumberInput}
                onChange={(e) => {
                  setQuoteNumberInput(e.target.value);
                  setLookupError('');
                }}
                disabled={lookupLoading}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500"
              />
              <Button
                type="submit"
                disabled={lookupLoading || !quoteNumberInput.trim()}
                className="bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 disabled:opacity-50 transition shrink-0"
              >
                {lookupLoading ? 'Checking...' : 'Track'}
              </Button>
            </div>
          </div>
        </form>
      </div>
      {lookupError && (
        <p className="text-xs text-rose-400 mt-2">{lookupError}</p>
      )}
    </div>
  );
}
