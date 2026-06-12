'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, X, Sparkles, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

const EXCLUDED_PREFIXES = ['/auth', '/mgmt', '/checkout'];

export function FloatingAIAssistant() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = React.useState(false);

  const isExcluded = EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isExcluded) return null;

  const aiHref = '/ai-research';

  return (
    <div className="floating-ai-anchor fixed bottom-6 right-4 z-50 sm:right-6">
      {open && (
        <div className="mb-3 w-[290px] rounded-2xl border border-border bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">AI Assistant</p>
                <p className="text-xs text-muted-foreground">Ask anything about products.</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close AI assistant"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <Link
              href={aiHref}
              className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/20"
              onClick={() => setOpen(false)}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Start AI Research
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-[11px] text-muted-foreground">
              Need pricing? Share your requirements and get recommendations.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label="Open AI assistant"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'group flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-gradient-to-br from-primary/60 to-primary text-white shadow-[0_0_25px_rgba(37,99,235,0.45)] transition hover:shadow-[0_0_35px_rgba(37,99,235,0.65)]',
          open && 'ring-2 ring-primary/60'
        )}
      >
        <Bot className="h-6 w-6 transition-transform group-hover:scale-110" />
      </button>
    </div>
  );
}
