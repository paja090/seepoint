import Link from 'next/link';
import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { PageHeader, Card } from '@/components/ui';
import { listNavigationContracts } from '@/lib/navigation/contract-service';
import { prisma } from '@/lib/db';
import { ContractManagementView } from '@/components/navigation/ContractManagementView';

export const dynamic = 'force-dynamic';

export default async function NavigationContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess('navigationProjects');
  const params = await searchParams;

  const clientId = typeof params.clientId === 'string' ? params.clientId : undefined;
  const status = typeof params.status === 'string' ? params.status : undefined;
  const query = typeof params.query === 'string' ? params.query : undefined;

  const [contracts, clients] = await Promise.all([
    listNavigationContracts(user, { clientId, status, query }),
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="📄 Evidence smluv navigační reklamy"
        description="Správa smluv pronájmu, výroby a servisu navigačních cedulí s automatickými hlídači vypršení platnosti."
        actions={
          <Link href="/navigation" className="btn btn-secondary text-xs">
            ← Zpět na přehled navigace
          </Link>
        }
      />

      {/* Sub-navigation bar */}
      <div className="mb-6 flex border-b border-slate-200 gap-6 overflow-x-auto pb-1 text-sm font-bold">
        <Link href="/navigation" className="pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 whitespace-nowrap">
          📌 Přehled & Dashboard
        </Link>
        <Link href="/navigation/contracts" className="pb-2.5 border-b-2 border-sky-600 text-sky-700 whitespace-nowrap">
          📄 Evidence smluv
        </Link>
        <Link href="/navigation/contacts" className="pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 whitespace-nowrap">
          👥 Kontaktní osoby
        </Link>
      </div>

      <ContractManagementView initialContracts={JSON.parse(JSON.stringify(contracts))} clients={clients} />
    </AppShell>
  );
}
