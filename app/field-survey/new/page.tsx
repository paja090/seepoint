import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { redirect } from 'next/navigation';
import { enterTenantContext } from '@/lib/tenant-context';
import { createFieldSurvey } from '@/lib/field-survey/data';

export const dynamic = 'force-dynamic';

export default async function NewFieldSurveyPage() {
  const user = await requirePageAccess('fieldSurvey');

  async function createSurveyAction(formData: FormData) {
    'use server';
    const auth = await requirePageAccess('fieldSurvey');
    if (!auth.organizationId) throw new Error('Organizace nenalezena.');
    enterTenantContext({ organizationId: auth.organizationId, userId: auth.id, source: 'session' });

    const name = String(formData.get('name') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();

    if (!name) throw new Error('Název je povinný.');

    const survey = await createFieldSurvey({
      name,
      description: description || undefined,
      createdByUserId: auth.id,
    });

    redirect(`/field-survey/${survey.id}`);
  }

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Nový terénní průzkum</h1>
          <p className="text-sm text-slate-500 mt-1">
            Vytvořte průzkumnou akci, do které budou pracovníci v terénu ukládat nalezené plochy.
          </p>
        </header>

        <form action={createSurveyAction} className="card space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Název akce *
            </label>
            <input
              name="name"
              type="text"
              required
              maxLength={200}
              placeholder="Např. Ostrava – Centrum a Poruba 2026"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Popis a zadání pro terén
            </label>
            <textarea
              name="description"
              rows={4}
              maxLength={1000}
              placeholder="Hledáme ploty podél hlavních tahů, volné stěny pro bannery a místa pro Ačka..."
              className="input w-full resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <a href="/field-survey" className="btn border border-slate-200 text-slate-700">
              Zrušit
            </a>
            <button type="submit" className="btn btn-primary">
              Vytvořit a otevřít
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
