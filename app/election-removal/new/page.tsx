import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { KmlImportWizard } from '@/components/election-removal/KmlImportWizard';
import { ArrowLeft, Vote } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewElectionRemovalCampaignPage() {
  await checkElectionRemovalPageAccess();

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/election-removal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zpět na přehled kampaní</span>
          </Link>

          <div className="mt-2 flex items-center gap-3">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <Vote className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Nová demontážní akce (KML Import)
              </h1>
              <p className="text-sm text-slate-500">
                Nahrajte KML export z Google My Maps, zkontrolujte mapování vrstev a potvrďte import médií.
              </p>
            </div>
          </div>
        </div>

        {/* Wizard Component */}
        <KmlImportWizard />
      </div>
    </AppShell>
  );
}
