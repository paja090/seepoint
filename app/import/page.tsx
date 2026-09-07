import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { PageHeader } from '@/components/ui';
import { UniversalImportWizard } from '@/components/imports/UniversalImportWizard';
import { ImportHistoryList } from '@/components/imports/ImportHistoryList';
import { MediaImportPreview } from '@/components/MediaImportPreview';
import { NavigationImportPreview } from '@/components/NavigationImportPreview';

export default async function ImportPage() {
  await requirePageAccess('import');

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          title="📥 Univerzální AI Import dat"
          description="Bezpečný překladač firemních databází (.xlsx, .xls, .csv) do jednotného OOH modelu SeePointu. Vždy s kontrolním náhledem (Dry-Run) a ochranou produkčních dat."
        />

        {/* Primary: Modern Universal AI Wizard */}
        <section>
          <UniversalImportWizard />
        </section>

        {/* Import History */}
        <section>
          <ImportHistoryList />
        </section>

        {/* Legacy single-purpose importers (collapsible for backward compatibility) */}
        <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition">
          <summary className="text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900">
            Předchozí jednoúčelové importéry (Mediální plochy, Navigační nosiče)
          </summary>
          <div className="mt-4 grid gap-6 xl:grid-cols-2 pt-4 border-t border-slate-100">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Import mediálních ploch (TSV)</h3>
              <MediaImportPreview />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Import navigačních nosičů (TSV)</h3>
              <NavigationImportPreview />
            </div>
          </div>
        </details>
      </div>
    </AppShell>
  );
}
