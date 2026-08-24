import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CreateOrganizationForm } from '@/components/CreateOrganizationForm';
import { platformPrisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/organization';
import { getOrganizationAIUsage } from '@/lib/ai-usage';

export default async function OrganizationsAdminPage() {
  try {
    await requireSuperAdmin();
  } catch {
    notFound();
  }

  const organizations = await platformPrisma.organization.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const counts = await platformPrisma.advertisingSurface.groupBy({
    by: ['organizationId'],
    _count: { _all: true },
  });

  const surfaceCounts = new Map(counts.map((row) => [row.organizationId, row._count._all]));

  // Load AI usage for each organization
  const aiUsagesList = await Promise.all(
    organizations.map((org) => getOrganizationAIUsage(org.id))
  );
  const aiUsageMap = new Map(organizations.map((org, index) => [org.id, aiUsagesList[index]]));

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Správa organizací (Super Admin)</h1>
        <p className="mt-2 text-slate-600">Platformní administrace firem, tarifů a spotřeby AI v SeePoint OS.</p>
      </div>

      <CreateOrganizationForm />

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-3">Organizace</th>
              <th className="p-3">Tarif</th>
              <th className="p-3">Členové</th>
              <th className="p-3">Plochy</th>
              <th className="p-3">🤖 AI Měsíčně</th>
              <th className="p-3">Stav</th>
              <th className="p-3">Založeno</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => {
              const ai = aiUsageMap.get(org.id);
              const calls = ai?.totalCalls || 0;
              const costUsd = ai?.totalCostUsd || 0;

              return (
                <tr className="border-t hover:bg-slate-50" key={org.id}>
                  <td className="p-3">
                    <Link className="font-bold text-sky-700 hover:underline" href={`/admin/organizations/${org.id}`}>
                      {org.name}
                    </Link>
                    <div className="text-xs text-slate-500 font-mono">{org.slug}</div>
                  </td>
                  <td className="p-3 font-bold text-purple-700">{org.plan}</td>
                  <td className="p-3 font-semibold">{org._count.members}</td>
                  <td className="p-3 font-semibold">{surfaceCounts.get(org.id) ?? 0}</td>
                  <td className="p-3">
                    <span className="font-bold text-purple-900 block">{calls} dotazů</span>
                    <span className="text-[11px] text-slate-500 font-mono">${costUsd.toFixed(3)}</span>
                  </td>
                  <td className="p-3">
                    {org.isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        Aktivní
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                        Deaktivovaná
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500 text-xs">{org.createdAt.toLocaleDateString('cs-CZ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
