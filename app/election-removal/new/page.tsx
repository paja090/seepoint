import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { NewCampaignTabsView } from '@/components/election-removal/NewCampaignTabsView';
import { NewFieldAction } from '@/components/election-removal/NewFieldAction';
import { ArrowLeft, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewElectionRemovalCampaignPage() {
  const user = await checkElectionRemovalPageAccess();

  const clients = await prisma.client.findMany({
    where: { organizationId: user.organization!.id, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

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
            <span>Zpět na přehled terénních prací</span>
          </Link>

          <div className="mt-2 flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Nová zakázka terénních prací
              </h1>
              <p className="text-sm text-slate-500">
                Zvolte účel zakázky a termín. Jednotlivá místa a práce doplníte v dalším kroku.
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Creator Tabs Component */}
        <NewFieldAction clients={clients} />
        <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-medium">Mám soubor KML/KMZ nebo chci zadat více míst v mapě</summary><div className="mt-4 space-y-3">
        <p>Importované operace jsou návrhy klasifikace. Před plánováním potvrďte zadání, materiál a cílovou GPS.</p>
        <NewCampaignTabsView /></div></details>
      </div>
    </AppShell>
  );
}
