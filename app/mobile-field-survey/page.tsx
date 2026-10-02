import Link from 'next/link';
import { requirePageAccess } from '@/lib/page-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { listFieldSurveys } from '@/lib/field-survey/data';

export const dynamic = 'force-dynamic';

export default async function MobileFieldSurveyIndexPage() {
  const user = await requirePageAccess('fieldSurvey');
  if (user.organizationId) {
    enterTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' });
  }

  const surveys = await listFieldSurveys({ status: 'ACTIVE' });

  return (
    <div className="min-h-dvh bg-slate-950 text-white p-4 space-y-5">
      <header className="py-2 border-b border-slate-800">
        <h1 className="text-xl font-bold">Terénní průzkum ploch</h1>
        <p className="text-xs text-slate-400 mt-1">
          Vyberte průzkumnou akci, do které chcete fotografovat nové plochy:
        </p>
      </header>

      {surveys.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 text-center space-y-3">
          <span className="text-3xl">📋</span>
          <p className="text-sm font-semibold">Žádný aktivní průzkum</p>
          <p className="text-xs text-slate-400">
            Před začátkem focení vytvořte průzkum v počítačovém rozhraní nebo kontaktujte manažera.
          </p>
          <Link
            href="/field-survey/new"
            className="btn btn-primary text-xs py-2 px-4 inline-block mt-2"
          >
            Vytvořit průzkum
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map((survey) => (
            <Link
              key={survey.id}
              href={`/mobile-field-survey/${survey.id}`}
              className="block rounded-2xl bg-slate-900 border border-slate-800 p-4 hover:border-sky-500 transition active:bg-slate-800"
            >
              <div className="flex items-start justify-between">
                <h2 className="font-bold text-base text-white">{survey.name}</h2>
                <span className="text-xl">📷 →</span>
              </div>
              {survey.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{survey.description}</p>
              )}
              <div className="mt-3 text-xs text-slate-500 flex justify-between">
                <span>{survey._count.points} zapsaných ploch</span>
                <span className="text-sky-400 font-semibold">Začít fotit</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="text-center pt-4">
        <Link href="/mobile-photos" className="text-xs text-slate-500 underline">
          ← Zpět na standardní focení zakázek
        </Link>
      </div>
    </div>
  );
}
