"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/hooks';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useToast } from '../../hooks/use-toast';

export function QuoteCTA() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [summary, setSummary] = React.useState('');
  const [gstIncluded, setGstIncluded] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const handleRequest = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'Sign in to generate and download your quote PDF.' });
      router.push('/auth/signin?redirect=/customised-setups');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, gstIncluded }),
      });

      if (res.status === 401) {
        toast({ title: 'Login required', description: 'Please sign in to download your quote PDF.' });
        router.push('/auth/signin?redirect=/customised-setups');
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const message = err?.details || err?.error || 'Failed to generate quote';
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'quote.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Quote ready', description: 'Downloaded quote PDF. A copy was emailed too.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Quote failed', description: error?.message || 'Unable to generate quote.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-primary font-semibold">Get a PDF Quote</p>
          <p className="text-xs text-muted-foreground">Signed quote with 7-day validity. Login required.</p>
        </div>
        <Button size="sm" onClick={handleRequest} disabled={submitting || loading}>
          {submitting ? 'Preparing…' : 'Download Quote'}
        </Button>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="quote-summary">Notes / Requirements</Label>
          <Textarea
            id="quote-summary"
            placeholder="Describe your requirement or site details"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={gstIncluded} onCheckedChange={(v) => setGstIncluded(Boolean(v))} aria-label="Include GST details on the quote" />
          Include GST details on the quote
        </label>
      </div>
    </div>
  );
}
