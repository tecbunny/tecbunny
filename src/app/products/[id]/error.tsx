"use client";

import { uiText } from '@/lib/strings';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <section className="min-h-[70vh] bg-slate-950 text-slate-200 flex items-center justify-center px-4">
      <div className="max-w-lg rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
        <h2 className="text-xl font-semibold text-white">{uiText.productDetail.errorTitle}</h2>
        <p className="mt-2 text-sm text-red-100/80">{error?.message || uiText.productDetail.errorBody}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
          >
            {uiText.productDetail.retry}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-red-400/60 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20"
          >
            {uiText.productDetail.reload}
          </button>
        </div>
      </div>
    </section>
  );
}
