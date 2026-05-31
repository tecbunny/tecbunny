import { uiText } from '@/lib/strings';

export default function Loading() {
  return (
    <section className="min-h-[70vh] bg-slate-950 text-slate-200 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl space-y-8">
        <div className="h-8 w-48 rounded-md bg-slate-800 animate-pulse" aria-label={uiText.productDetail.loadingTitle} />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="aspect-square rounded-2xl bg-slate-900 animate-pulse" />
          <div className="space-y-4">
            <div className="h-6 w-3/4 rounded bg-slate-800 animate-pulse" />
            <div className="h-6 w-1/2 rounded bg-slate-800 animate-pulse" />
            <div className="h-4 w-full rounded bg-slate-800 animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-slate-800 animate-pulse" />
            <div className="h-12 w-full rounded-lg bg-slate-800 animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
}
