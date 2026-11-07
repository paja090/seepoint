import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
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

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/organizations" className="text-xs font-bold text-sky-700 hover:underline">← Správa organizací</Link>
          <h1 className="mt-1 text-3xl font-bold">Poptávky dema z webu</h1>
          <p className="mt-2 text-slate-600">Žádosti z formuláře na webu. Na každou se ozvěte do 24 hodin.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{leads.length} poptávek</span>
      </div>

      <div className="card overflow-x-auto">
        {leads.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Zatím nepřišla žádná poptávka.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-3">Přijato</th>
                <th className="p-3">Firma</th>
                <th className="p-3">Kontakt</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Počet ploch</th>
                <th className="p-3">Zdroj</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr className="border-b last:border-0" key={lead.id}>
                  <td className="whitespace-nowrap p-3 text-slate-600">{dateFormat.format(lead.createdAt)}</td>
                  <td className="p-3 font-semibold text-slate-900">{lead.company}</td>
                  <td className="p-3">
                    <span className="block">{lead.name}</span>
                    <a className="text-xs text-sky-700 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a>
                  </td>
                  <td className="whitespace-nowrap p-3">{lead.phone ? <a className="text-sky-700 hover:underline" href={`tel:${lead.phone.replace(/\s+/g, '')}`}>{lead.phone}</a> : '—'}</td>
                  <td className="p-3">{lead.surfaceCount || '—'}</td>
                  <td className="p-3 text-xs text-slate-500">{lead.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
