import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { PrintProductionDashboard } from './PrintProductionDashboard';

export const dynamic = 'force-dynamic';

export default async function ProductionPage() {
  const user = await requirePageAccess('printProduction');

  return (
    <AppShell>
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-4xl">🖨️</span>
              Výroba, Tisk & Grafická data
            </h1>
            <p className="text-gray-500 mt-2 text-sm sm:text-base">
              Schvalování grafiky, tiskové objednávky a příjem materiálů na sklad
            </p>
          </div>
        </div>

        <PrintProductionDashboard />
      </div>
    </AppShell>
  );
}
