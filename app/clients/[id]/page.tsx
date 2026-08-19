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

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ tab?: string }>;
type Params = Promise<{ id: string }>;

export default async function ClientProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requirePageAccess('clients');
  const { id } = await params;
  const { tab = 'overview' } = await searchParams;

  const rawClient = await getClientProfile(id);
  if (!rawClient) {
    notFound();
  }

  const client = rawClient as unknown as ClientProfileData;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊', name: 'Přehled' },
    { id: 'contacts', label: 'Contacts', icon: '👥', name: `Kontakty (${client.contacts?.length || 0})` },
    { id: 'branches', label: 'Branches', icon: '🏬', name: `Pobočky (${client.branches?.length || 0})` },
    { id: 'offers', label: 'Offers', icon: '📄', name: `Nabídky (${client.offers?.length || 0})` },
    { id: 'orders', label: 'Orders', icon: '🛒', name: `Zakázky (${client.crmOrders?.length || 0})` },
    { id: 'realizations', label: 'Realizations', icon: '🛠️', name: 'Realizace' },
    { id: 'surfaces', label: 'Surfaces', icon: '🪧', name: `Reklamní plochy (${client.occupancies?.length || 0})` },
    { id: 'contracts', label: 'Contracts', icon: '📜', name: `Smlouvy (${client.contracts?.length || 0})` },
    { id: 'invoices', label: 'Invoices', icon: '💶', name: `Fakturace (${client.invoices?.length || 0})` },
    { id: 'communications', label: 'Communications', icon: '📞', name: `Komunikace (${client.communications?.length || 0})` },
    { id: 'tasks', label: 'Tasks', icon: '✅', name: `Úkoly (${client.crmTasks?.length || 0})` },
    { id: 'documents', label: 'Documents', icon: '📁', name: `Dokumenty (${client.documents?.length || 0})` },
    { id: 'audit', label: 'Audit', icon: '🛡️', name: 'Historie' },
  ];

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Main Client Profile Header & Metrics */}
        <ClientHeader client={client} />

        {/* AI Client Enrichment & ARES Lookup Card */}
        <ClientAiEnrichCard
          clientId={client.id}
          clientName={client.name}
          companyId={client.companyId}
          dic={client.dic}
          website={client.website}
        />

        {/* 13 CRM Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-0 text-sm font-medium scrollbar-thin">
          {tabs.map(t => {
            const isActive = tab === t.id;
            return (
              <a
                key={t.id}
                href={`/clients/${client.id}?tab=${t.id}`}
                className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'border-sky-600 text-sky-700 bg-sky-50/50 rounded-t-lg'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </a>
            );
          })}
        </div>

        {/* Tab Content Display */}
        {tab === 'overview' && <ClientOverviewTab client={client} />}
        {tab === 'contacts' && <ClientContactsTab client={client} />}
        {tab === 'branches' && <ClientBranchesTab client={client} />}
        {tab === 'offers' && <ClientOffersTab client={client} />}
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
