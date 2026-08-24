'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl space-y-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/seepoint-logo.svg" alt="SeePOINT" className="h-10 mx-auto object-contain" />
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 text-rose-950 space-y-2">
          <h2 className="text-xl font-black">Chyba při načítání stránky</h2>
          <p className="text-xs text-rose-800 leading-relaxed">
            Omlouváme se, při zpracování požadavku došlo k neočekávané chybě.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition w-full cursor-pointer"
          >
            Zkusit načíst znovu
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition w-full"
          >
            Zpět na hlavní stránku
          </Link>
        </div>
      </div>
    </div>
  );
}
