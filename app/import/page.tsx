import { AppShell } from '@/components/AppShell';
import { NavigationImportPreview } from '@/components/NavigationImportPreview';

export default function ImportPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Import dat</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Bezpečný náhled převodu městských databází navigací do jednotného modelu SeePOINT.
          Jeden fyzický sloup se připraví jako nosič a jednotlivé navigace různých klientů jako samostatné reklamní plochy.
        </p>
      </div>
      <NavigationImportPreview />
    </AppShell>
  );
}
