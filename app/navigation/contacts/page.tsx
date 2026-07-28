import Link from 'next/link';
import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { prisma } from '@/lib/db';
import { ContactPersonsManagementView } from '@/components/navigation/ContactPersonsManagementView';

export const dynamic = 'force-dynamic';

export default async function NavigationContactsPage() {
  const user = await requirePageAccess('navigationProjects');

  const [contactPersons, clients] = await Promise.all([
    prisma.navigationContactPerson.findMany({
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    }),
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="👥 Kontaktní osoby navigační reklamy"
        description="Správa klientů, agentur, odpovědných osob, telefonů a e-mailů u navigačních projektů."
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
        <Link href="/navigation/contracts" className="pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 whitespace-nowrap">
          📄 Evidence smluv
        </Link>
        <Link href="/navigation/contacts" className="pb-2.5 border-b-2 border-sky-600 text-sky-700 whitespace-nowrap">
          👥 Kontaktní osoby
        </Link>
      </div>

      <ContactPersonsManagementView initialContacts={JSON.parse(JSON.stringify(contactPersons))} clients={clients} />
    </AppShell>
  );
}
