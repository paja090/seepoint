import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { AdminOutreachEmailStudio, type DemoLeadRow } from '@/components/AdminOutreachEmailStudio';
import { platformPrisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/organization';

export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Prague' });

export default async function DemoLeadsAdminPage() {
  try {
    await requireSuperAdmin();
  } catch {
    notFound();
  }

  const leads = await platformPrisma.demoLead.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });

  const serializedLeads: DemoLeadRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    phone: lead.phone,
    surfaceCount: lead.surfaceCount,
    source: lead.source,
    createdAtIso: lead.createdAt.toISOString(),
    createdAtFormatted: dateFormat.format(lead.createdAt),
  }));

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/organizations" className="text-xs font-bold text-sky-700 hover:underline">
            ← Správa organizací
          </Link>
          <h1 className="mt-1 text-3xl font-bold">Oslovení firem & Poptávky dema</h1>
          <p className="mt-1 text-slate-600">
            Rozesílání profesionálních B2B e-mailů a přehled zájemců z webového formuláře.
          </p>
        </div>
      </div>

      <AdminOutreachEmailStudio leads={serializedLeads} />
    </AppShell>
  );
}
