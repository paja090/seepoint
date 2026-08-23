import { AppShell } from '@/components/AppShell';
import { platformPrisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/organization';
import { notFound } from 'next/navigation';
import { OrganizationStatusButton } from '@/components/OrganizationStatusButton';
export default async function OrganizationAdminDetail({ params }: { params: Promise<{ id: string }> }) {
  try { await requireSuperAdmin(); } catch { notFound(); }
  const { id } = await params;
  const organization = await platformPrisma.organization.findUnique({ where: { id }, include: { members: { include: { user: { select: { name: true, email: true, status: true } } } } } }); if (!organization) notFound();
  const [clients, surfaces, offers] = await Promise.all([platformPrisma.client.count({ where: { organizationId: id } }), platformPrisma.advertisingSurface.count({ where: { organizationId: id } }), platformPrisma.offer.count({ where: { organizationId: id } })]);
  return <AppShell><h1 className="text-3xl font-bold">{organization.name}</h1><p className="mt-2 text-slate-600">{organization.slug} · {organization.plan} · {organization.isActive ? 'aktivní' : 'deaktivovaná'}</p><OrganizationStatusButton id={organization.id} isActive={organization.isActive} /><div className="mt-6 grid gap-4 md:grid-cols-3"><div className="card"><b>{clients}</b><p>klientů</p></div><div className="card"><b>{surfaces}</b><p>ploch</p></div><div className="card"><b>{offers}</b><p>nabídek</p></div></div><div className="card mt-6"><h2 className="text-xl font-bold">Členové</h2><ul className="mt-3 divide-y">{organization.members.map((member) => <li className="py-3" key={member.id}>{member.user.name} · {member.user.email} · {member.role} · {member.isActive ? 'aktivní' : 'neaktivní'}</li>)}</ul></div></AppShell>;
}
