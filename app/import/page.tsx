import { CheckCircle2, Database, FileSearch, FileUp, GitBranch, ListChecks, UploadCloud } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card, EmptyState, PageHeader, Tabs } from '@/components/ui';
import { MediaImportPreview } from '@/components/MediaImportPreview';
import { NavigationImportPreview } from '@/components/NavigationImportPreview';

const steps = [
  ['Nahrát soubor', UploadCloud],
  ['Náhled dat', FileSearch],
  ['Mapování sloupců', GitBranch],
  ['Validace', ListChecks],
  ['Import', Database],
  ['Report', CheckCircle2],
] as const;

export default function ImportPage() {
  return (
    <AppShell>
      <PageHeader
        title="Import dat"
        description="Bezpečné kontrolní náhledy převodu firemních tabulek do jednotného modelu SeePOINT. Zdrojové soubory zůstávají beze změny."
      />

      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Průvodce importem</h2>
            <p className="mt-1 text-sm text-slate-500">Aktuálně jsou zapnuté kontrolní preview kroky. Samotný import běží přes existující ověřené akce.</p>
          </div>
          <FileUp className="text-slate-400" size={24} />
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {steps.map(([label, Icon], index) => (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={label}>
              <div className="mb-3 flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-sm font-semibold text-slate-950 ring-1 ring-slate-200">{index + 1}</span>
                <Icon className="text-slate-400" size={18} />
              </div>
              <p className="text-sm font-semibold text-slate-900">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Typ importu</h2>
            <p className="mt-1 text-sm text-slate-500">Rozdělení importů do přehledných karet.</p>
            <div className="mt-4 space-y-2">
              <a className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800" href="#media-import">Mediální plochy</a>
              <a className="block rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" href="#navigation-import">Navigační nosiče</a>
            </div>
          </Card>
          <EmptyState title="Chyby importu se zobrazí tady." description="Pokud validace selže, stránka má připravený prostor pro jasný error/report stav." />
        </aside>
        <main className="space-y-6">
          <section className="card" id="media-import">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><h2 className="text-xl font-semibold text-slate-950">Import mediálních ploch</h2><Tabs items={['Náhled', 'Mapování', 'Validace']} /></div>
            <MediaImportPreview />
          </section>
          <section className="card" id="navigation-import">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><h2 className="text-xl font-semibold text-slate-950">Import navigačních nosičů</h2><Tabs items={['Náhled', 'Mapování', 'Report']} /></div>
            <NavigationImportPreview />
          </section>
        </main>
      </div>
    </AppShell>
  );
}
