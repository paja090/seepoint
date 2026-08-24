import { AppShell } from '@/components/AppShell';
import { platformPrisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/organization';
import { notFound } from 'next/navigation';
import { OrganizationStatusButton } from '@/components/OrganizationStatusButton';
import { getOrganizationAIUsage } from '@/lib/ai-usage';
import Link from 'next/link';

export default async function OrganizationAdminDetail({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
  } catch {
    notFound();
  }

  const { id } = await params;
  const organization = await platformPrisma.organization.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { name: true, email: true, status: true },
          },
        },
      },
    },
  });

  if (!organization) notFound();

  const [clients, surfaces, offers, aiUsage] = await Promise.all([
    platformPrisma.client.count({ where: { organizationId: id } }),
    platformPrisma.advertisingSurface.count({ where: { organizationId: id } }),
    platformPrisma.offer.count({ where: { organizationId: id } }),
    getOrganizationAIUsage(id),
  ]);

  const costCzk = Math.round((aiUsage.totalCostUsd || 0) * 23.5);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <Link href="/admin/organizations" className="text-xs font-bold text-sky-700 hover:underline">
              ← Zpět na přehled firem
            </Link>
            <h1 className="text-3xl font-black text-slate-900 mt-1">{organization.name}</h1>
            <p className="text-sm text-slate-500 font-medium">
              {organization.slug} · Tarif: <span className="font-bold text-purple-700">{organization.plan}</span> ·{' '}
              {organization.isActive ? (
                <span className="text-emerald-600 font-bold">Aktivní SaaS firma</span>
              ) : (
                <span className="text-rose-600 font-bold">Deaktivováno</span>
              )}
            </p>
          </div>
          <OrganizationStatusButton id={organization.id} isActive={organization.isActive} />
        </div>

        {/* System & AI Metric Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="card border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Klienti</span>
            <strong className="text-2xl font-black text-slate-900 block">{clients}</strong>
          </div>

          <div className="card border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Reklamní plochy</span>
            <strong className="text-2xl font-black text-slate-900 block">{surfaces}</strong>
          </div>

          <div className="card border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Nabídky</span>
            <strong className="text-2xl font-black text-slate-900 block">{offers}</strong>
          </div>

          {/* AI Usage Metric Box */}
          <div className="card border-purple-200 bg-purple-50/50">
            <span className="text-xs font-bold text-purple-700 uppercase">🤖 AI Spotřeba Tento Měsíc</span>
            <strong className="text-2xl font-black text-purple-900 block">{aiUsage.totalCalls} dotazů</strong>
            <span className="text-[11px] text-purple-700 font-semibold block">
              ~ {costCzk} Kč (${aiUsage.totalCostUsd.toFixed(3)})
            </span>
          </div>
        </div>

        {/* AI Detailed Usage Box */}
        <div className="card border-purple-200 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-purple-800/80 pb-3">
            <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>🤖 SeePoint AI Engine — Statistiky spotřeby kreditů</span>
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-950 text-purple-200 border border-purple-700">
              Od 1. v měsíci
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-purple-800/60">
              <span className="text-slate-400 block font-semibold">Počet AI Operací</span>
              <strong className="text-base font-black text-white">{aiUsage.totalCalls} generování</strong>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-purple-800/60">
              <span className="text-slate-400 block font-semibold">Spotřebované Tokeny</span>
              <strong className="text-base font-black text-purple-300">
                {((aiUsage.totalPromptTokens + aiUsage.totalOutputTokens) / 1000).toFixed(1)}k tokenů
              </strong>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-purple-800/60">
              <span className="text-slate-400 block font-semibold">Odhadované náklady na AI API</span>
              <strong className="text-base font-black text-emerald-400">
                {costCzk} Kč (${aiUsage.totalCostUsd.toFixed(3)} USD)
              </strong>
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="card">
          <h2 className="text-xl font-bold">Členové organizace</h2>
          <ul className="mt-3 divide-y">
            {organization.members.map((member) => (
              <li className="py-3 flex items-center justify-between" key={member.id}>
                <div>
                  <span className="font-bold text-slate-900">{member.user.name}</span>
                  <span className="text-xs text-slate-500 block">{member.user.email}</span>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    {member.role}
                  </span>
                  <span
                    className={`ml-2 text-xs font-bold ${member.isActive ? 'text-emerald-600' : 'text-slate-400'}`}
                  >
                    {member.isActive ? 'Aktivní' : 'Neaktivní'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
