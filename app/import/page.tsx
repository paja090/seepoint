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
        <details className="group rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4 transition">
          <summary className="text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200">
            Předchozí jednoúčelové importéry (Mediální plochy, Navigační nosiče)
          </summary>
          <div className="mt-4 grid gap-6 xl:grid-cols-2 pt-2 border-t border-slate-800/60">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Import mediálních ploch (TSV)</h3>
              <MediaImportPreview />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Import navigačních nosičů (TSV)</h3>
              <NavigationImportPreview />
            </div>
          </div>
        </details>
      </div>
    </AppShell>
  );
}
