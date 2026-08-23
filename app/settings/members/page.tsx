import { AppShell } from '@/components/AppShell';
import { InviteOrganizationMemberForm } from '@/components/InviteOrganizationMemberForm';
import { OrganizationInvitationsTable } from '@/components/OrganizationInvitationsTable';
import { platformPrisma } from '@/lib/db';
import { requireOrganizationRole } from '@/lib/organization';

export default async function OrganizationMembersPage() {
  const { organizationId, membership } = await requireOrganizationRole('ADMIN');
  const [members, invitations] = await Promise.all([
    platformPrisma.organizationMember.findMany({ where: { organizationId }, include: { user: { select: { name: true, email: true, status: true } } }, orderBy: { createdAt: 'asc' } }),
    platformPrisma.organizationInvitation.findMany({ where: { organizationId, acceptedAt: null, revokedAt: null }, select: { id: true, email: true, role: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  const now = new Date();
  return <AppShell><div className="mb-6"><h1 className="text-3xl font-bold">Uživatelé organizace</h1><p className="mt-2 text-slate-600">Jeden přihlašovací účet může být členem více organizací.</p></div><InviteOrganizationMemberForm /><OrganizationInvitationsTable canManageOwner={membership.role === 'OWNER'} invitations={invitations.map((invitation) => ({ id: invitation.id, email: invitation.email, role: invitation.role, expired: invitation.expiresAt <= now, expiresAtLabel: invitation.expiresAt.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' }), createdAtLabel: invitation.createdAt.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' }) }))} /><div className="card mt-6 overflow-x-auto"><h2 className="mb-3 text-lg font-bold">Členové organizace</h2><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Jméno</th><th className="p-2">E-mail</th><th className="p-2">Role</th><th className="p-2">Stav</th></tr></thead><tbody>{members.map((member) => <tr className="border-t" key={member.id}><td className="p-2">{member.user.name}</td><td className="p-2">{member.user.email}</td><td className="p-2">{member.role}</td><td className="p-2">{member.isActive ? member.user.status : 'SUSPENDED_IN_ORG'}</td></tr>)}</tbody></table></div></AppShell>;
}
