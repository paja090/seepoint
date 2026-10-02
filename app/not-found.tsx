import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl space-y-5">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-amber-950 space-y-2">
          <h2 className="text-xl font-black">Stránka nebo nabídka nebyla nalezena (404)</h2>
          <p className="text-xs text-amber-800 leading-relaxed">
            Požadovaná stránka neexistuje nebo byl odkaz na nabídku aktualizován.
          </p>
        </div>
        <p className="text-xs text-slate-500">Ověřte odkaz u jeho odesílatele nebo u správce vaší organizace.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition w-full"
        >
          Přejít na hlavní stránku
        </Link>
      </div>
    </div>
  );
}
