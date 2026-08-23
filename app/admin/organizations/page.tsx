import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CreateOrganizationForm } from '@/components/CreateOrganizationForm';
import { platformPrisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/organization';
export default async function OrganizationsAdminPage() {
  try { await requireSuperAdmin(); } catch { notFound(); }
  const organizations = await platformPrisma.organization.findMany({ include: { _count: { select: { members: true } } }, orderBy: { createdAt: 'desc' } });
  const counts = await platformPrisma.advertisingSurface.groupBy({ by: ['organizationId'], _count: { _all: true } }); const surfaceCounts = new Map(counts.map((row) => [row.organizationId, row._count._all]));
  return <AppShell><div className="mb-6"><h1 className="text-3xl font-bold">Správa organizací</h1><p className="mt-2 text-slate-600">Platformní administrace SeePoint.</p></div><CreateOrganizationForm /><div className="card mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Organizace</th><th className="p-2">Tarif</th><th className="p-2">Členové</th><th className="p-2">Plochy</th><th className="p-2">Stav</th><th className="p-2">Založeno</th></tr></thead><tbody>{organizations.map((org) => <tr className="border-t" key={org.id}><td className="p-2"><Link className="font-semibold text-sky-700" href={`/admin/organizations/${org.id}`}>{org.name}</Link><div className="text-xs text-slate-500">{org.slug}</div></td><td className="p-2">{org.plan}</td><td className="p-2">{org._count.members}</td><td className="p-2">{surfaceCounts.get(org.id) ?? 0}</td><td className="p-2">{org.isActive ? 'Aktivní' : 'Deaktivovaná'}</td><td className="p-2">{org.createdAt.toLocaleDateString('cs-CZ')}</td></tr>)}</tbody></table></div></AppShell>;
}
