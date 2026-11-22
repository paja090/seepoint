import { Prisma, ClientType } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { ClientLogoControl } from '@/components/ClientLogoControl';
import { AddClientModalButton } from '@/components/crm/ClientListControl';
import { ClientDuplicatesModalButton } from '@/components/crm/ClientDuplicatesModal';
import { requirePageAccess } from '@/lib/page-auth';
import { Button, EmptyState, FilterBar, PageHeader, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { prisma } from '@/lib/db';
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from '@/lib/crm/types';
import { buildClientSearchWhere } from '@/lib/crm/search-query';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | string[] | undefined) { return first(value)?.trim() || undefined; }

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Všechny typy' },
  { value: 'AGENCIES', label: 'Agentury (reklamní i mediální)' },
  { value: 'DIRECT_CLIENT', label: 'Přímí klienti' },
  { value: 'RETAIL_CHAIN', label: 'Sítě prodejen / více poboček' },
  { value: 'LOCAL_BUSINESS', label: 'Lokální firmy' },
  { value: 'PUBLIC_INSTITUTION', label: 'Veřejné instituce' },
] as const;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePageAccess('clients');
  const params = await searchParams;
  const q = clean(params.q);
  const typeFilter = clean(params.type) || '';
  const requestedPage = Number.parseInt(clean(params.page) || '1', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 100;

  const andClauses: Prisma.ClientWhereInput[] = [{ active: true }];
  if (q) {
    andClauses.push(buildClientSearchWhere(q));
  }
  if (typeFilter === 'AGENCIES') {
    andClauses.push({ clientType: { in: ['ADVERTISING_AGENCY', 'MEDIA_AGENCY'] } });
  } else if (typeFilter === 'RETAIL_CHAIN') {
    andClauses.push({
      OR: [
        { clientType: 'RETAIL_CHAIN' },
        { branches: { some: { active: true } } },
      ],
    });
  } else if (typeFilter && Object.keys(CLIENT_TYPE_LABELS).includes(typeFilter)) {
    andClauses.push({ clientType: typeFilter as ClientType });
  }

  const where: Prisma.ClientWhereInput = andClauses.length === 1 ? andClauses[0] : { AND: andClauses };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        assignedUser: { select: { name: true } },
        branches: {
          where: { active: true },
          select: { id: true, name: true, city: true },
          take: 3,
          orderBy: { name: 'asc' },
        },
        crmOrders: {
          select: {
            agencyName: true,
            agencyClient: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            occupancies: true,
            offers: true,
            crmOrders: true,
            agencyCrmOrders: true,
            branches: { where: { active: true } },
            invoices: true,
          },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const queryParts: string[] = [];
  if (q) queryParts.push(`q=${encodeURIComponent(q)}`);
  if (typeFilter) queryParts.push(`type=${encodeURIComponent(typeFilter)}`);
  const querySuffix = queryParts.length > 0 ? `&${queryParts.join('&')}` : '';

  return (
    <AppShell>
      <PageHeader
        title="CRM Klienti"
        description="Centrální evidence koncových klientů, agentur, poboček, nabídek a zakázek."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button href="/clients/orders" variant="secondary">📋 Zakázky & Agentury</Button>
            <ClientDuplicatesModalButton />
            <AddClientModalButton />
          </div>
        }
      />

      <FilterBar>
        <form className="flex flex-col gap-3 md:flex-row md:items-end" method="get">
          <label className="flex-1 text-sm font-medium">
            Vyhledat klienta, agenturu nebo pobočku
            <input
              className="input mt-1"
              name="q"
              defaultValue={q ?? ''}
              placeholder="Název klienta, agentura, pobočka, číslo zakázky, kontakt, e-mail nebo IČO"
            />
          </label>
          <label className="w-full md:w-64 text-sm font-medium">
            Typ partnera
            <select className="input mt-1" name="type" defaultValue={typeFilter}>
              {TYPE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <Button type="submit">Hledat</Button>
          <Button href="/clients" variant="secondary">Vymazat</Button>
          <span className="text-sm text-slate-500 md:ml-auto">Nalezeno: <strong className="text-slate-950">{total}</strong></span>
        </form>
      </FilterBar>

      <section className="card !p-0">
        {clients.length === 0 ? (
          <div className="p-5"><EmptyState title="Žádný odpovídající klient." description="Zkuste upravit hledaný výraz nebo založte nového klienta tlačítkem v hlavičce." /></div>
        ) : (
          <Table minWidth="min-w-[1100px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Logo</TableHeaderCell>
                <TableHeaderCell>Název / Agentury / Pobočky</TableHeaderCell>
                <TableHeaderCell>Typ & Stav</TableHeaderCell>
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
                const isAgency = client.clientType === 'ADVERTISING_AGENCY' || client.clientType === 'MEDIA_AGENCY';
                const linkedAgencies = Array.from(
                  new Set(
                    client.crmOrders
                      .map((o) => o.agencyClient?.name || o.agencyName)
                      .filter((v): v is string => Boolean(v && v.trim()))
                  )
                ).slice(0, 2);

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
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {client.companyId && <span className="font-mono">IČO: {client.companyId}</span>}
                        {client._count.branches > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200/80">
                            🏬 {client._count.branches} {client._count.branches === 1 ? 'pobočka' : client._count.branches < 5 ? 'pobočky' : 'poboček'}
                          </span>
                        )}
                        {linkedAgencies.map((ag) => (
                          <span key={ag} className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 border border-violet-200/80">
                            🤝 {ag}
                          </span>
                        ))}
                      </div>
                      {client.branches.length > 0 && (
                        <div className="mt-0.5 text-[11px] text-slate-400 truncate max-w-xs">
                          {client.branches.map((b) => (b.city ? `${b.name} (${b.city})` : b.name)).join(' · ')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusObj.badge}`}>
                          {statusObj.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            isAgency
                              ? 'bg-violet-50 text-violet-800 border-violet-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {CLIENT_TYPE_LABELS[client.clientType as keyof typeof CLIENT_TYPE_LABELS] || client.clientType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{client.contactPerson ?? <span className="text-slate-400">Neuvedeno</span>}</TableCell>
                    <TableCell>
                      <div className="text-xs">{client.email || '-'}</div>
                      <div className="text-xs text-slate-500">{client.phone || ''}</div>
                    </TableCell>
                    <TableCell>{client.assignedUser?.name || '-'}</TableCell>
                    <TableCell><span className="font-bold text-slate-900">{client._count.occupancies}</span></TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-900">{client._count.crmOrders}</div>
                      {client._count.agencyCrmOrders > 0 && (
                        <div className="text-[11px] font-semibold text-violet-700">
                          +{client._count.agencyCrmOrders} jako agentura
                        </div>
                      )}
                    </TableCell>
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

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Stránkování klientů">
          <Button href={page > 1 ? `/clients?page=${page - 1}${querySuffix}` : undefined} variant="secondary" disabled={page <= 1}>
            ← Předchozí
          </Button>
          <span className="text-sm text-slate-600">Strana <strong>{Math.min(page, totalPages)}</strong> z <strong>{totalPages}</strong></span>
          <Button href={page < totalPages ? `/clients?page=${page + 1}${querySuffix}` : undefined} variant="secondary" disabled={page >= totalPages}>
            Další →
          </Button>
        </nav>
      )}
    </AppShell>
  );
}
