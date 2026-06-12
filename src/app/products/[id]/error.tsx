"use client";

import { uiText } from '@/lib/strings';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <section className="min-h-[70vh] bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-lg rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">{uiText.productDetail.errorTitle}</h2>
        <p className="mt-2 text-sm text-destructive">{error?.message || uiText.productDetail.errorBody}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
          >
            {uiText.productDetail.retry}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-destructive/40 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
          >
            {uiText.productDetail.reload}
          </button>
        </div>
      </div>
    </section>
  );
}
