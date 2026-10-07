import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { loadElectionPlanningResources } from '@/lib/election-removal/planning';
import { ElectionRoutePlanner } from '@/components/election-removal/ElectionRoutePlanner';
import { ArrowLeft, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ElectionRemovalPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await checkElectionRemovalPageAccess();
  const { id } = await params;

  try {
    const { campaign, employees, vehicles } = await loadElectionPlanningResources(
      id,
      undefined,
      user.organization!.id
    );

    return (
      <AppShell>
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* Breadcrumb Navigation */}
          <div>
            <Link
              href={`/election-removal/${campaign.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zpět na detail kampaně</span>
            </Link>

            <div className="mt-2 flex items-center gap-3">
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Plánování demontážních tras: {campaign.name}
                </h1>
                <p className="text-sm text-slate-500">
                  Přiřaďte pracovníky a vozidla do posádek a vygenerujte optimalizované trasy výjezdů.
                </p>
              </div>
            </div>
          </div>

          {/* Planner Component */}
          <ElectionRoutePlanner
            campaign={campaign}
            employees={employees}
            vehicles={vehicles}
          />
        </div>
      </AppShell>
    );
  } catch (error) {
    console.error('Chyba při načítání kampaně pro plánování:', error);
    if (
      error instanceof Error &&
      error.message.includes('Volební kampaň nebyla nalezena')
    ) {
      notFound();
    }
    throw error;
  }
}
