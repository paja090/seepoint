import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { ClientLogoControl } from '@/components/ClientLogoControl';
import { AddClientModalButton } from '@/components/crm/ClientListControl';
import { requirePageAccess } from '@/lib/page-auth';
import { Button, EmptyState, FilterBar, PageHeader, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { prisma } from '@/lib/db';
import { CLIENT_STATUS_LABELS } from '@/lib/crm/types';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | string[] | undefined) { return first(value)?.trim() || undefined; }

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePageAccess('clients');
  const params = await searchParams;
  const q = clean(params.q);
  const where: Prisma.ClientWhereInput = { active: true };
  if (q) where.OR = [
    { name: { contains: q, mode: 'insensitive' } },
    { contactPerson: { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
    { phone: { contains: q, mode: 'insensitive' } },
    { companyId: { contains: q, mode: 'insensitive' } },
  ];

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      assignedUser: { select: { name: true } },
      _count: { select: { occupancies: true, offers: true, crmOrders: true, invoices: true } },
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="CRM Klienti"
        description="Centrální evidence obchodních partnerů, kontaktů, nabídek a zakázek."
        actions={<AddClientModalButton />}
      />

      <FilterBar>
        <form className="flex flex-col gap-3 md:flex-row md:items-end" method="get">
          <label className="flex-1 text-sm font-medium">Vyhledat klienta<input className="input mt-1" name="q" defaultValue={q ?? ''} placeholder="Název, kontakt, e-mail nebo IČO" /></label>
          <Button type="submit">Hledat</Button>
          <Button href="/clients" variant="secondary">Vymazat</Button>
          <span className="text-sm text-slate-500 md:ml-auto">Nalezeno: <strong className="text-slate-950">{clients.length}</strong></span>
        </form>
      </FilterBar>

      <section className="card !p-0">
        {clients.length === 0 ? (
          <div className="p-5"><EmptyState title="Zatím není uložený žádný klient." description="Založte první společnost tlačítkem v hlavičce." /></div>
        ) : (
          <Table minWidth="min-w-[1000px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Logo</TableHeaderCell>
                <TableHeaderCell>Název klienta</TableHeaderCell>
                <TableHeaderCell>Stav</TableHeaderCell>
                <TableHeaderCell>Kontaktní osoba</TableHeaderCell>
                <TableHeaderCell>Email & Telefon</TableHeaderCell>
                <TableHeaderCell>Obchodník</TableHeaderCell>
                <TableHeaderCell>Kampaně</TableHeaderCell>
                <TableHeaderCell>Zakázky</TableHeaderCell>
                <TableHeaderCell>Akce</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {clients.map((client) => {
                const statusObj = CLIENT_STATUS_LABELS[client.status as keyof typeof CLIENT_STATUS_LABELS] || CLIENT_STATUS_LABELS.ACTIVE;
                return (
                  <tr className="hover:bg-slate-50/70 cursor-pointer" key={client.id}>
                    <TableCell>
                      <ClientLogoControl
                        clientId={client.id}
                        clientName={client.name}
                        compact={true}
                        logoUrl={
                          client.logoDriveFileId
                            ? `/api/clients/${client.id}/logo/file`
                            : client.website
                            ? `https://www.google.com/s2/favicons?domain=${client.website.replace(/^https?:\/\//i, '').split('/')[0]}&sz=256`
                            : undefined
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <a href={`/clients/${client.id}`} className="font-bold text-slate-900 hover:text-sky-700 hover:underline">{client.name}</a>
                      {client.companyId && <div className="text-xs text-slate-500 font-mono">IČO: {client.companyId}</div>}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusObj.badge}`}>
                        {statusObj.label}
                      </span>
                    </TableCell>
                    <TableCell>{client.contactPerson ?? <span className="text-slate-400">Neuvedeno</span>}</TableCell>
                    <TableCell>
                      <div className="text-xs">{client.email || '-'}</div>
                      <div className="text-xs text-slate-500">{client.phone || ''}</div>
                    </TableCell>
                    <TableCell>{client.assignedUser?.name || '-'}</TableCell>
                    <TableCell><span className="font-bold text-slate-900">{client._count.occupancies}</span></TableCell>
                    <TableCell><span className="font-bold text-slate-900">{client._count.crmOrders}</span></TableCell>
                    <TableCell>
                      <a className="button !py-1 !px-2.5 !text-xs" href={`/clients/${client.id}`}>Otevřít CRM →</a>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </AppShell>
  );
}
