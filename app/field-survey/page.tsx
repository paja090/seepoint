import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { listFieldSurveys } from '@/lib/field-survey/data';

export const dynamic = 'force-dynamic';

export default async function FieldSurveyListPage() {
  const user = await requirePageAccess('fieldSurvey');
  if (user.organizationId) {
    enterTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' });
  }

  const surveys = await listFieldSurveys();

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Terénní průzkum ploch</h1>
            <p className="text-sm text-slate-500 mt-1">
              Pasportizace a vyhledávání nových potenciálních reklamních lokalit v terénu.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/mobile-field-survey"
              className="btn bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-sm font-semibold"
            >
              📱 Mobilní focení
            </Link>
            <Link
              href="/field-survey/new"
              className="btn btn-primary text-sm font-semibold"
            >
              + Nový průzkum
            </Link>
          </div>
        </header>

        {surveys.length === 0 ? (
          <div className="card text-center py-12 space-y-3">
            <span className="text-4xl">🗺️</span>
            <h2 className="text-lg font-bold text-slate-900">Zatím nebyl vytvořen žádný průzkum</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Vytvořte první průzkumnou akci (např. &ldquo;Průzkum centra města&rdquo;) a začněte zaznamenávat body v terénu mobilem.
            </p>
            <Link href="/field-survey/new" className="btn btn-primary text-sm inline-block">
              Vytvořit průzkumnou akci
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {surveys.map((survey) => (
              <Link
                key={survey.id}
                href={`/field-survey/${survey.id}`}
                className="card hover:shadow-md transition hover:border-slate-300 block space-y-3"
              >
                <div className="flex items-start justify-between">
                  <h2 className="font-bold text-base text-slate-900 hover:text-sky-600 transition">
                    {survey.name}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    survey.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {survey.status === 'ACTIVE' ? 'Aktivní' : survey.status}
                  </span>
                </div>

                {survey.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{survey.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span>{survey._count.points} {survey._count.points === 1 ? 'bod' : survey._count.points <= 4 ? 'body' : 'bodů'}</span>
                  <span>{new Date(survey.createdAt).toLocaleDateString('cs-CZ')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
