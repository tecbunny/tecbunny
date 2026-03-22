import type { Metadata } from 'next';
import Link from "next/link";

export const metadata: Metadata = {
  title: 'Page Not Found | TecBunny Solutions',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-3xl font-semibold mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-6 max-w-prose">
        Sorry, we couldn’t find the page you’re looking for. It may have been moved or
        deleted.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/" className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm hover:opacity-90">
          Go to Home
        </Link>
        <Link href="/products" className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-muted">
          Browse Products
        </Link>
      </div>
    </main>
  );
}
