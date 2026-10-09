import Link from 'next/link';

export function AcademySetupNotice() {
  return (
    <section className="card mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Akademie se připravuje</h1>
      <p className="text-slate-600">
        Správce musí dokončit přípravu Akademie pro tuto organizaci. Ostatní části aplikace můžete používat dál.
      </p>
      <div className="pt-2 border-t border-slate-100">
        <Link
          href="/academy/review"
          className="inline-flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Prohlédnout připravené návody a průchody (Náhled) →
        </Link>
      </div>
    </section>
  );
}
