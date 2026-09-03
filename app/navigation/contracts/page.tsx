import Link from 'next/link';
import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { listNavigationContracts } from '@/lib/navigation/contract-service';
import { parseNavigationContractFilters } from '@/lib/navigation/contract-policy';
import { prisma } from '@/lib/db';
import { ContractManagementView } from '@/components/navigation/ContractManagementView';

import { ProjectSubNav } from '@/components/navigation/ProjectSubNav';

export const dynamic = 'force-dynamic';

const navSubNavItems = [
  { href: '/navigation', label: '📋 Projekty Navigace' },
  { href: '/navigation/contracts', label: '📋 Evidence smluv VO' },
  { href: '/navigation/contacts', label: '🏛️ Kontaktní osoby měst' },
  { href: '/navigation/documentation', label: '📷 Fotodokumentace & Reporty' },
];

export default async function NavigationContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess('navigationContracts');
  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === 'string') urlParams.set(key, value);
  const filters = parseNavigationContractFilters(urlParams);

  const [contractsResult, clients] = await Promise.all([
    listNavigationContracts(user, filters),
    prisma.client.findMany({
      where: { organizationId: user.organizationId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);

  return (
    <AppShell>
      <ProjectSubNav items={navSubNavItems} />
      <PageHeader
        title="📄 Evidence smluv navigační reklamy"
        description="Správa smluv pronájmu, výroby a servisu navigačních cedulí s automatickými hlídači vypršení platnosti."
        actions={
          <Link href="/navigation" className="btn btn-secondary text-xs">
            ← Zpět na přehled navigace
          </Link>
        }
      />

      <ContractManagementView
        initialContracts={JSON.parse(JSON.stringify(contractsResult.items))}
        total={contractsResult.total}
        clients={clients}
        currentDate={new Date().toISOString()}
      />
    </AppShell>
  );
}
