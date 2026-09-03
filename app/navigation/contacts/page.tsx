import Link from 'next/link';
import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { prisma } from '@/lib/db';
import { listNavigationContactPersons } from '@/lib/navigation/contract-service';
import { ContactPersonsManagementView } from '@/components/navigation/ContactPersonsManagementView';
import { ProjectSubNav } from '@/components/navigation/ProjectSubNav';

export const dynamic = 'force-dynamic';

const navSubNavItems = [
  { href: '/navigation', label: '📋 Projekty Navigace' },
  { href: '/navigation/contracts', label: '📋 Evidence smluv VO' },
  { href: '/navigation/contacts', label: '🏛️ Kontaktní osoby měst' },
  { href: '/navigation/documentation', label: '📷 Fotodokumentace & Reporty' },
];

export default async function NavigationContactsPage() {
  const user = await requirePageAccess('navigationContacts');

  const [contactsResult, clients] = await Promise.all([
    listNavigationContactPersons(user),
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
        title="👥 Kontaktní osoby navigační reklamy"
        description="Správa klientů, agentur, odpovědných osob, telefonů a e-mailů u navigačních projektů."
        actions={
          <Link href="/navigation" className="btn btn-secondary text-xs">
            ← Zpět na přehled navigace
          </Link>
        }
      />

      <ContactPersonsManagementView
        initialContacts={JSON.parse(JSON.stringify(contactsResult.items))}
        total={contactsResult.total}
        clients={clients}
      />
    </AppShell>
  );
}
