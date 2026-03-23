'use client';

type PublicRouteErrorProps = {
  title: string;
  description: string;
  reset: () => void;
};

export function PublicRouteError({ title, description, reset }: PublicRouteErrorProps) {
  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center px-4 py-20 sm:px-6 lg:px-8">
        <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-300">
          Route Error
        </span>
        <h1 className="mt-6 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm text-slate-400 sm:text-base">{description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
          >
            Try again
          </button>
          <a
            href="/contact"
            className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 hover:text-white"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}