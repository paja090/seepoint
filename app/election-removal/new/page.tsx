import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { NewCampaignTabsView } from '@/components/election-removal/NewCampaignTabsView';
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
                Vyberte plochy přímo ze systému podle klientů (např. kontrola navigací, laviček či billboardů), nahrajte KML mapu nebo naklikejte body v mapě.
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Creator Tabs Component */}
        <NewCampaignTabsView clients={clients} />
      </div>
    </AppShell>
  );
}
