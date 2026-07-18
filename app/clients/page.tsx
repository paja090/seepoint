import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { ClientLogoControl } from '@/components/ClientLogoControl';
import { requirePageAccess } from '@/lib/page-auth';
import { Button, EmptyState, FilterBar, PageHeader, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { prisma } from '@/lib/db';

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
    include: { _count: { select: { occupancies: true, offers: true, currentSurfaces: true } } },
  });

  return (
    <AppShell>
      <PageHeader title="Klienti" description="Obchodní evidence klientů pro obsazenost, rezervace a nabídky." />

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
          <div className="p-5"><EmptyState title="Zatím není uložený žádný klient." description="Klienti vznikají pro nabídky a obsazenost. Jakmile budou založení, zobrazí se v této tabulce." /></div>
        ) : (
          <Table minWidth="min-w-[980px]">
            <TableHead><tr><TableHeaderCell>Logo</TableHeaderCell><TableHeaderCell>Název klienta</TableHeaderCell><TableHeaderCell>Kontaktní osoba</TableHeaderCell><TableHeaderCell>Email</TableHeaderCell><TableHeaderCell>Telefon</TableHeaderCell><TableHeaderCell>Aktivní kampaně</TableHeaderCell><TableHeaderCell>Nabídky</TableHeaderCell><TableHeaderCell>Poznámka</TableHeaderCell><TableHeaderCell>Akce</TableHeaderCell></tr></TableHead>
            <tbody>
              {clients.map((client) => (
                <tr className="hover:bg-slate-50/60" key={client.id}>
                  <TableCell><ClientLogoControl clientId={client.id} clientName={client.name} logoUrl={client.logoDriveFileId ? `/api/clients/${client.id}/logo/file` : undefined} /></TableCell>
                  <TableCell><b>{client.name}</b>{client.companyId && <><br /><span className="text-slate-500">{client.companyId}</span></>}</TableCell>
                  <TableCell>{client.contactPerson ?? <span className="text-slate-400">Neuvedeno</span>}</TableCell>
                  <TableCell>{client.email ?? <span className="text-slate-400">-</span>}</TableCell>
                  <TableCell>{client.phone ?? <span className="text-slate-400">-</span>}</TableCell>
                  <TableCell>{client._count.occupancies}</TableCell>
                  <TableCell>{client._count.offers}</TableCell>
                  <TableCell>{client.note ?? <span className="text-slate-400">-</span>}</TableCell>
                  <TableCell><a className="table-action" href={`/clients?q=${encodeURIComponent(client.name)}`}>Filtrovat</a></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </AppShell>
  );
}
