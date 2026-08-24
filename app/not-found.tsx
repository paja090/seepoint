import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl space-y-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/seepoint-logo.svg" alt="SeePOINT" className="h-10 mx-auto object-contain" />
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-amber-950 space-y-2">
          <h2 className="text-xl font-black">Stránka nebo nabídka nebyla nalezena (404)</h2>
          <p className="text-xs text-amber-800 leading-relaxed">
            Požadovaná stránka neexistuje nebo byl odkaz na nabídku aktualizován.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Pro asistenci nás kontaktujte na{' '}
          <a href="mailto:info@seepoint.cz" className="text-sky-600 font-bold underline">
            info@seepoint.cz
          </a>
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition w-full"
        >
          Přejít na hlavní stránku SeePOINT
        </Link>
      </div>
    </div>
  );
}
