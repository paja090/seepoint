'use client';

import { useState, useEffect, useCallback } from 'react';
import { SalesOpportunitiesHeader } from './SalesOpportunitiesHeader';
import { OpportunityFiltersBar, FilterState } from './OpportunityFiltersBar';
import { OpportunityCard, OpportunityItem } from './OpportunityCard';
import { ManualOpportunityModal } from './ManualOpportunityModal';
import { AiOfferGeneratorModal, ClientOption } from '@/components/offers/AiOfferGeneratorModal';
import { RefreshCw, Radar } from 'lucide-react';

const initialFilters: FilterState = {
  search: '',
  city: '',
  eventType: '',
  status: '',
  minScore: '',
};

export function SalesOpportunitiesClientView({
  clients = [],
  initialOpportunityData,
}: {
  clients?: ClientOption[];
  initialOpportunityData?: {
    items: OpportunityItem[];
    total: number;
    stats: {
      totalNew: number;
      totalHighScore: number;
      totalContactThisWeek: number;
      totalProposals: number;
      totalConverted: number;
    };
  };
}) {
  const [items, setItems] = useState<OpportunityItem[]>(initialOpportunityData?.items || []);
  const [stats, setStats] = useState(
    initialOpportunityData?.stats || {
      totalNew: 0,
      totalHighScore: 0,
      totalContactThisWeek: 0,
      totalProposals: 0,
      totalConverted: 0,
    }
  );
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [isAutoDiscovering, setIsAutoDiscovering] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);

  // Copilot integration state
  const [copilotModalOpen, setCopilotModalOpen] = useState(false);
  const [copilotPreFill, setCopilotPreFill] = useState<{
    clientId?: string;
    clientName?: string;
    city?: string;
    prompt?: string;
    mediaType?: string;
    targetName?: string;
    targetAddress?: string;
    opportunityId?: string;
    isNoPriceConcept?: boolean;
  } | null>(null);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.search) query.set('search', filters.search);
      if (filters.city) query.set('city', filters.city);
      if (filters.eventType) query.set('eventType', filters.eventType);
      if (filters.status) query.set('status', filters.status);
      if (filters.minScore) query.set('minScore', filters.minScore);

      const res = await fetch(`/api/sales/opportunities?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to reload opportunities', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  const handleUpdateStatus = async (id: string, status: string, dismissedReason?: string) => {
    if (status === 'DISMISSED' && !filters.status) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
    try {
      const res = await fetch(`/api/sales/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, dismissedReason }),
      });
      if (res.ok) {
        fetchOpportunities();
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleLinkCrm = async (item: OpportunityItem) => {
    try {
      const res = await fetch(`/api/sales/opportunities/${item.id}/link-crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        fetchOpportunities();
      }
    } catch (err) {
      console.error('Failed to link CRM', err);
    }
  };

  const handlePrepareProposal = (item: OpportunityItem) => {
    const suggestedMedia = Array.isArray(item.suggestedMediaTypes) ? item.suggestedMediaTypes[0] : '';
    const fullTargetAddress = item.address
      ? (item.address.toLowerCase().includes(item.city.toLowerCase()) ? item.address : `${item.address}, ${item.city}`)
      : item.city;

    setCopilotPreFill({
      clientId: item.clientId || undefined,
      clientName: item.companyName,
      city: item.city,
      prompt: `Nezávazný koncept kampaně k události: ${item.title}. ${item.summary}`,
      mediaType: suggestedMedia || 'CITY_POSTER',
      targetName: item.companyName,
      targetAddress: fullTargetAddress,
      opportunityId: item.id,
      isNoPriceConcept: true,
    });
    setCopilotModalOpen(true);
  };

  const handleAutoDiscover = async () => {
    setIsAutoDiscovering(true);
    try {
      const res = await fetch('/api/sales/opportunities/auto-discover', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        await fetchOpportunities();
      }
    } catch (err) {
      console.error('Auto discover failed', err);
    } finally {
      setIsAutoDiscovering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Stats */}
      <SalesOpportunitiesHeader
        stats={stats}
        onOpenManualModal={() => setManualModalOpen(true)}
        onAutoDiscover={handleAutoDiscover}
        isAutoDiscovering={isAutoDiscovering}
      />

      {/* Filter Bar */}
      <OpportunityFiltersBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Card List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            <span className="text-sm font-semibold">Načítám příležitosti...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-3">
            <Radar className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">Žádné příležitosti neodpovídají filtrům</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Zkuste upravit nebo vynulovat vyhledávací kritéria nebo přidejte novou příležitost ručně.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <OpportunityCard
              key={item.id}
              item={item}
              onPrepareProposal={handlePrepareProposal}
              onLinkCrm={handleLinkCrm}
              onUpdateStatus={(id, status, reason) => handleUpdateStatus(id, status, reason)}
            />
          ))
        )}
      </div>

      {/* Manual Opportunity AI Insertion Modal */}
      <ManualOpportunityModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onSuccess={() => fetchOpportunities()}
      />

      {/* AI Offer Generator Modal */}
      <AiOfferGeneratorModal
        isOpen={copilotModalOpen}
        onClose={() => setCopilotModalOpen(false)}
        clients={clients}
        preFill={copilotPreFill}
      />
    </div>
  );
}
