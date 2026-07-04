import { AppShell } from '@/components/AppShell';
import { MediaImportPreview } from '@/components/MediaImportPreview';
import { NavigationImportPreview } from '@/components/NavigationImportPreview';

export default function ImportPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Import dat</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Bezpečné kontrolní náhledy převodu různých firemních tabulek do jednotného modelu SeePOINT.
          Zdrojové soubory zůstávají beze změny.
        </p>
      </div>
      <div className="space-y-10">
        <MediaImportPreview />
        <div className="border-t border-slate-300 pt-8">
          <NavigationImportPreview />
        </div>
      </div>
    </AppShell>
  );
}
