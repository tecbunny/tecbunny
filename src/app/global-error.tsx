'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Fatal root layout crash', {
      message: error?.message || 'Unknown Error',
      stack: error?.stack,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 font-sans text-zinc-100 antialiased p-6">
        <div className="max-w-md w-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-950/50 text-red-500 border border-red-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
            {error?.message || 'A fatal system crash occurred. Please reload the application.'}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2.5 px-4 rounded-lg transition-colors border border-zinc-700 active:scale-95 cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
