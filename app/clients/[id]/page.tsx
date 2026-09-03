import { notFound } from 'next/navigation';
import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { getClientProfile } from '@/lib/crm/client-service';
import { ClientHeader } from '@/components/crm/ClientHeader';
import { ClientOverviewTab } from '@/components/crm/ClientOverviewTab';
import { ClientContactsTab } from '@/components/crm/ClientContactsTab';
import { ClientBranchesTab } from '@/components/crm/ClientBranchesTab';
import { ClientOffersTab } from '@/components/crm/ClientOffersTab';
import { ClientOrdersTab } from '@/components/crm/ClientOrdersTab';
import { ClientRealizationsTab } from '@/components/crm/ClientRealizationsTab';
import { ClientSurfacesTab } from '@/components/crm/ClientSurfacesTab';
import { ClientContractsTab } from '@/components/crm/ClientContractsTab';
import { ClientInvoicesTab } from '@/components/crm/ClientInvoicesTab';
import { ClientCommunicationsTab } from '@/components/crm/ClientCommunicationsTab';
import { ClientTasksTab } from '@/components/crm/ClientTasksTab';
import { ClientDocumentsTab } from '@/components/crm/ClientDocumentsTab';
import { ClientAuditTab } from '@/components/crm/ClientAuditTab';
import { ClientAiEnrichCard } from '@/components/clients/ClientAiEnrichCard';
import { ClientProfileData } from '@/lib/crm/types';
import { canConvertOfferRole } from '@/lib/offers/domain';

export const dynamic = 'force-dynamic';

const crmDateFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' });

type SearchParams = Promise<{ tab?: string }>;
type Params = Promise<{ id: string }>;

export default async function ClientProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await requirePageAccess('clients');
  const { id } = await params;
  const { tab = 'overview' } = await searchParams;

  const rawClient = await getClientProfile(id);
  if (!rawClient) {
    notFound();
  }

  const client = {
    ...rawClient,
    invoices: rawClient.invoices.map((invoice) => ({
      ...invoice,
      issueDateLabel: crmDateFormatter.format(invoice.issueDate),
      dueDateLabel: crmDateFormatter.format(invoice.dueDate),
    })),
  } as unknown as ClientProfileData;

  const tabs = [
    { id: 'overview', icon: '📊', name: 'Přehled' },
    { id: 'contacts', icon: '👥', name: 'Kontakty', count: client.contacts?.length || 0 },
    { id: 'branches', icon: '🏬', name: 'Pobočky MS Kraj', count: client.branches?.length || 0 },
    { id: 'offers', icon: '📄', name: 'Nabídky', count: client.offers?.length || 0 },
    { id: 'orders', icon: '🛒', name: 'Zakázky', count: client.crmOrders?.length || 0 },
    { id: 'realizations', icon: '🛠️', name: 'Realizace' },
    { id: 'surfaces', icon: '🪧', name: 'Reklamní Plochy', count: client.occupancies?.length || 0 },
    { id: 'contracts', icon: '📜', name: 'Smlouvy', count: client.contracts?.length || 0 },
    { id: 'invoices', icon: '💶', name: 'Fakturace', count: client.invoices?.length || 0 },
    { id: 'communications', icon: '📞', name: 'Komunikace', count: client.communications?.length || 0 },
    { id: 'tasks', icon: '✅', name: 'Úkoly', count: client.crmTasks?.length || 0 },
    { id: 'documents', icon: '📁', name: 'Dokumenty', count: client.documents?.length || 0 },
    { id: 'audit', icon: '🛡️', name: 'Historie' },
  ];

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Main Client Profile Header & Metrics */}
        <ClientHeader client={client} canManageLifecycle={user.role === 'ADMIN' || user.role === 'MANAGER'} />

        {/* AI Client Enrichment & ARES Lookup Card */}
        <ClientAiEnrichCard
          clientId={client.id}
          clientName={client.name}
          companyId={client.companyId}
          dic={client.dic}
          website={client.website}
        />

        {/* Enterprise Tab Bar */}
        <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 shadow-2xs overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-1 min-w-max">
            {tabs.map((t) => {
              const isActive = tab === t.id;
              return (
                <a
                  key={t.id}
                  href={`/clients/${client.id}?tab=${t.id}`}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-sky-950 shadow-sm border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span className="text-sm">{t.icon}</span>
                  <span>{t.name}</span>
                  {typeof t.count === 'number' && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>

        {/* Tab Content Display */}
        {tab === 'overview' && <ClientOverviewTab client={client} />}
        {tab === 'contacts' && <ClientContactsTab client={client} />}
        {tab === 'branches' && <ClientBranchesTab client={client} />}
        {tab === 'offers' && <ClientOffersTab client={client} canConvert={canConvertOfferRole(user.role)} />}
        {tab === 'orders' && <ClientOrdersTab client={client} />}
        {tab === 'realizations' && <ClientRealizationsTab client={client} />}
        {tab === 'surfaces' && <ClientSurfacesTab client={client} />}
        {tab === 'contracts' && <ClientContractsTab client={client} />}
        {tab === 'invoices' && <ClientInvoicesTab client={client} />}
        {tab === 'communications' && <ClientCommunicationsTab client={client} />}
        {tab === 'tasks' && <ClientTasksTab client={client} />}
        {tab === 'documents' && <ClientDocumentsTab client={client} />}
        {tab === 'audit' && <ClientAuditTab client={client} />}
      </div>
    </AppShell>
  );
}
