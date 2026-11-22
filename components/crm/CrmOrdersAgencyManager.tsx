'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, FilterBar, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import {
  ORDER_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type ClientType,
  type CrmOrderStatus,
  type CrmProjectType,
} from '@/lib/crm/types';

export type CrmBranchRef = {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
};

export type CrmClientWithBranchesOption = {
  id: string;
  name: string;
  clientType: ClientType;
  companyId?: string | null;
  branches: CrmBranchRef[];
};

export type CrmOrderManagerRow = {
  id: string;
  orderNumber: string;
  clientOrderCode?: string | null;
  title: string;
  projectType: CrmProjectType;
  status: CrmOrderStatus;
  clientId: string;
  agencyClientId?: string | null;
  agencyName?: string | null;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  totalPrice?: number | null;
  note?: string | null;
  client: {
    id: string;
    name: string;
    companyId?: string | null;
    branches: CrmBranchRef[];
  };
  agencyClient?: { id: string; name: string; companyId?: string | null } | null;
  branch?: CrmBranchRef | null;
  assignedUser?: { id: string; name: string } | null;
  realizationBranches: Array<{ id: string; name: string; city?: string | null }>;
  realizationsCount: number;
  workOrdersCount: number;
};

type AgencyFilterMode = 'ALL' | 'MISSING_AGENCY' | 'WITH_AGENCY' | 'MULTI_BRANCH';

export function CrmOrdersAgencyManager({
  initialOrders,
  clients,
}: {
  initialOrders: CrmOrderManagerRow[];
  clients: CrmClientWithBranchesOption[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<CrmOrderManagerRow[]>(initialOrders);
  const [q, setQ] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<AgencyFilterMode>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);

  // Custom agency inline drafts for rows where user types free-text agency name
  const [customAgencyDrafts, setCustomAgencyDrafts] = useState<Record<string, string>>({});

  // Create order modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newClientId, setNewClientId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newAgencyClientId, setNewAgencyClientId] = useState('');
  const [newAgencyName, setNewAgencyName] = useState('');
  const [newBranchId, setNewBranchId] = useState('');
  const [newProjectType, setNewProjectType] = useState<CrmProjectType>('COMBINED');
  const [newStatus, setNewStatus] = useState<CrmOrderStatus>('CONFIRMED');
  const [newTotalPrice, setNewTotalPrice] = useState('');
  const [newNote, setNewNote] = useState('');

  const { agenciesList, otherClientsList } = useMemo(() => {
    const agencies = clients.filter((c) => c.clientType === 'ADVERTISING_AGENCY' || c.clientType === 'MEDIA_AGENCY');
    const others = clients.filter((c) => c.clientType !== 'ADVERTISING_AGENCY' && c.clientType !== 'MEDIA_AGENCY');
    return { agenciesList: agencies, otherClientsList: others };
  }, [clients]);

  const selectedNewClientBranches = useMemo(() => {
    const found = clients.find((c) => c.id === newClientId);
    return found?.branches ?? [];
  }, [clients, newClientId]);

  const counts = useMemo(() => {
    let missingAgency = 0;
    let withAgency = 0;
    let multiBranch = 0;
    for (const o of orders) {
      const hasAgency = Boolean(o.agencyClientId || o.agencyName?.trim());
      if (hasAgency) withAgency += 1;
      else missingAgency += 1;
      if (o.client.branches.length > 1 || o.realizationBranches.length > 1) {
        multiBranch += 1;
      }
    }
    return { total: orders.length, missingAgency, withAgency, multiBranch };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      const hasAgency = Boolean(o.agencyClientId || o.agencyName?.trim());
      if (agencyFilter === 'MISSING_AGENCY' && hasAgency) return false;
      if (agencyFilter === 'WITH_AGENCY' && !hasAgency) return false;
      if (agencyFilter === 'MULTI_BRANCH' && o.client.branches.length <= 1 && o.realizationBranches.length <= 1) {
        return false;
      }
      if (statusFilter && o.status !== statusFilter) return false;

      if (!needle) return true;
      const haystack = [
        o.orderNumber,
        o.clientOrderCode,
        o.title,
        o.client.name,
        o.client.companyId,
        o.agencyClient?.name,
        o.agencyClient?.companyId,
        o.agencyName,
        o.branch?.name,
        o.branch?.code,
        o.branch?.city,
        ...o.client.branches.flatMap((b) => [b.name, b.code, b.city]),
        ...o.realizationBranches.flatMap((b) => [b.name, b.city]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [orders, q, agencyFilter, statusFilter]);

  const patchOrder = async (
    orderId: string,
    payload: { agencyClientId?: string | null; agencyName?: string | null; branchId?: string | null }
  ) => {
    setSavingOrderId(orderId);
    try {
      const res = await fetch(`/api/crm/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Změnu se nepodařilo uložit.');
        return;
      }
      const updated = data.order;
      setOrders((prev) =>
        prev.map((row) =>
          row.id === orderId
            ? {
                ...row,
                agencyClientId: updated.agencyClientId ?? null,
                agencyName: updated.agencyName ?? null,
                agencyClient: updated.agencyClient ?? null,
                branchId: updated.branchId ?? null,
                branch: updated.branch ?? null,
              }
            : row
        )
      );
      setSavedOrderId(orderId);
      setTimeout(() => {
        setSavedOrderId((current) => (current === orderId ? null : current));
      }, 2000);
    } catch {
      alert('Chyba komunikace se serverem.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/crm/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: newClientId,
          title: newTitle.trim(),
          agencyClientId: newAgencyClientId || null,
          agencyName: newAgencyName.trim() || null,
          branchId: newBranchId || null,
          projectType: newProjectType,
          status: newStatus,
          totalPrice: newTotalPrice.trim() ? Number(newTotalPrice.replace(/\s+/g, '').replace(',', '.')) : null,
          note: newNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error || 'Zakázku se nepodařilo založit.');
        return;
      }
      setShowCreateModal(false);
      setNewClientId('');
      setNewTitle('');
      setNewAgencyClientId('');
      setNewAgencyName('');
      setNewBranchId('');
      setNewTotalPrice('');
      setNewNote('');
      router.refresh();
      // Optimistically prepend newly created order
      if (data.order) {
        const clientOption = clients.find((c) => c.id === data.order.clientId);
        setOrders((prev) => [
          {
            id: data.order.id,
            orderNumber: data.order.orderNumber,
            clientOrderCode: data.order.clientOrderCode,
            title: data.order.title,
            projectType: data.order.projectType,
            status: data.order.status,
            clientId: data.order.clientId,
            agencyClientId: data.order.agencyClientId,
            agencyName: data.order.agencyName,
            branchId: data.order.branchId,
            dateFrom: data.order.dateFrom ?? null,
            dateTo: data.order.dateTo ?? null,
            totalPrice: data.order.totalPrice != null ? Number(data.order.totalPrice) : null,
            note: data.order.note ?? null,
            client: {
              id: data.order.client.id,
              name: data.order.client.name,
              companyId: data.order.client.companyId,
              branches: clientOption?.branches ?? [],
            },
            agencyClient: data.order.agencyClient ?? null,
            branch: data.order.branch ?? null,
            assignedUser: data.order.assignedUser ?? null,
            realizationBranches: [],
            realizationsCount: 0,
            workOrdersCount: 0,
          },
          ...prev,
        ]);
      }
    } catch {
      setCreateError('Chyba komunikace se serverem.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <FilterBar>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-sm font-medium">
              Vyhledat podle koncového klienta, agentury, pobočky nebo čísla zakázky
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Např. Kofola, Knowlimits, Ostrava Svinov, ZAK-2026…"
                className="input mt-1"
              />
            </label>
            <label className="w-full md:w-52 text-sm font-medium">
              Stav zakázky
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input mt-1"
              >
                <option value="">Všechny stavy</option>
                {(Object.entries(ORDER_STATUS_LABELS) as [CrmOrderStatus, { label: string }][]).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
            </label>
            <Button onClick={() => setShowCreateModal(true)}>➕ Nová zakázka</Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: `Vše (${counts.total})` },
                  { id: 'MISSING_AGENCY', label: `Bez agentury (${counts.missingAgency})` },
                  { id: 'WITH_AGENCY', label: `Přes agenturu (${counts.withAgency})` },
                  { id: 'MULTI_BRANCH', label: `Více poboček (${counts.multiBranch})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAgencyFilter(tab.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    agencyFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              Zobrazeno: <strong className="text-slate-900">{filteredOrders.length}</strong> zakázek
            </span>
          </div>
        </div>
      </FilterBar>

      <section className="card !p-0">
        {filteredOrders.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Žádná odpovídající zakázka"
              description="Zkuste upravit filtr nebo založte novou zakázku tlačítkem výše."
            />
          </div>
        ) : (
          <Table minWidth="min-w-[1160px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Zakázka</TableHeaderCell>
                <TableHeaderCell>Koncový klient</TableHeaderCell>
                <TableHeaderCell>Agentura (rychlé doplnění)</TableHeaderCell>
                <TableHeaderCell>Pobočka</TableHeaderCell>
                <TableHeaderCell>Stav & Cena</TableHeaderCell>
                <TableHeaderCell className="text-right">Otevřít</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {filteredOrders.map((order) => {
                const statusObj =
                  ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || ORDER_STATUS_LABELS.DRAFT;
                const isSaving = savingOrderId === order.id;
                const isSaved = savedOrderId === order.id;
                const customDraft = customAgencyDrafts[order.id] ?? (!order.agencyClientId ? order.agencyName || '' : '');

                return (
                  <tr key={order.id} className="hover:bg-slate-50/70 align-top">
                    <TableCell>
                      <div className="font-bold text-slate-900">{order.title}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {order.orderNumber}
                        {order.clientOrderCode ? ` · ${order.clientOrderCode}` : ''}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {PROJECT_TYPE_LABELS[order.projectType] || order.projectType}
                        {order.realizationsCount > 0 ? ` · ${order.realizationsCount} pozic` : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`/clients/${order.client.id}?tab=orders`}
                        className="font-bold text-sky-700 hover:underline"
                      >
                        {order.client.name}
                      </a>
                      {order.client.companyId && (
                        <div className="text-[11px] font-mono text-slate-400">IČO: {order.client.companyId}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5 min-w-[260px]">
                        <select
                          value={order.agencyClientId || ''}
                          disabled={isSaving}
                          aria-label={`Agentura z CRM pro zakázku ${order.orderNumber}`}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            if (!nextId) {
                              void patchOrder(order.id, { agencyClientId: null, agencyName: null });
                              setCustomAgencyDrafts((prev) => ({ ...prev, [order.id]: '' }));
                            } else {
                              const found = clients.find((c) => c.id === nextId);
                              void patchOrder(order.id, {
                                agencyClientId: nextId,
                                agencyName: found?.name ?? null,
                              });
                            }
                          }}
                          className="input !py-1 !px-2 text-xs bg-white w-full"
                        >
                          <option value="">— Přímá zakázka / vlastní text —</option>
                          {agenciesList.length > 0 && (
                            <optgroup label="Agentury v CRM">
                              {agenciesList
                                .filter((ag) => ag.id !== order.clientId)
                                .map((ag) => (
                                  <option key={ag.id} value={ag.id}>
                                    🤝 {ag.name}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                          {otherClientsList.length > 0 && (
                            <optgroup label="Ostatní firmy v CRM">
                              {otherClientsList
                                .filter((ag) => ag.id !== order.clientId)
                                .map((ag) => (
                                  <option key={ag.id} value={ag.id}>
                                    {ag.name}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </select>
                        {!order.agencyClientId && (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={customDraft}
                              disabled={isSaving}
                              onChange={(e) =>
                                setCustomAgencyDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void patchOrder(order.id, {
                                    agencyClientId: null,
                                    agencyName: customDraft.trim() || null,
                                  });
                                }
                              }}
                              placeholder="Nebo zadejte název agentury ručně…"
                              className="input !py-1 !px-2 text-[11px] flex-1 bg-slate-50"
                            />
                            {customDraft.trim() !== (order.agencyName || '').trim() && (
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() =>
                                  void patchOrder(order.id, {
                                    agencyClientId: null,
                                    agencyName: customDraft.trim() || null,
                                  })
                                }
                                className="rounded-lg bg-violet-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-violet-700 cursor-pointer shrink-0"
                              >
                                Uložit
                              </button>
                            )}
                          </div>
                        )}
                        {order.agencyClient && (
                          <a
                            href={`/clients/${order.agencyClient.id}`}
                            className="inline-block text-[11px] font-semibold text-violet-700 hover:underline"
                          >
                            Otevřít profil agentury ↗
                          </a>
                        )}
                        {isSaved && <div className="text-[11px] font-bold text-emerald-700">✓ Uloženo</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 min-w-[180px]">
                        {order.client.branches.length > 0 ? (
                          <select
                            value={order.branchId || ''}
                            disabled={isSaving}
                            aria-label={`Pobočka pro zakázku ${order.orderNumber}`}
                            onChange={(e) => void patchOrder(order.id, { branchId: e.target.value || null })}
                            className="input !py-1 !px-2 text-xs bg-white w-full"
                          >
                            <option value="">— Více poboček / bez —</option>
                            {order.client.branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                🏬 {b.name}{b.city ? ` (${b.city})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-400">Klient bez poboček</span>
                        )}
                        {order.realizationBranches.length > 0 && (
                          <div className="text-[11px] text-indigo-700">
                            Pozice: {order.realizationBranches.map((b) => b.name).join(', ')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusObj.badge}`}>
                        {statusObj.label}
                      </span>
                      <div className="mt-1 font-bold text-xs text-slate-900">
                        {order.totalPrice ? `${order.totalPrice.toLocaleString('cs-CZ')} Kč` : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <a
                          href={`/clients/${order.client.id}?tab=orders`}
                          className="text-xs font-bold text-sky-700 hover:underline"
                        >
                          Zakázky klienta →
                        </a>
                        {order.realizationsCount > 0 && (
                          <a
                            href={`/clients/${order.client.id}?tab=realizations`}
                            className="text-[11px] font-semibold text-indigo-700 hover:underline"
                          >
                            Pozice & fotky ({order.realizationsCount})
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>

      {/* New Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-xl w-full bg-white space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-base text-slate-900">➕ Založit novou CRM zakázku</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-800">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Koncový klient *
                <select
                  required
                  value={newClientId}
                  onChange={(e) => {
                    setNewClientId(e.target.value);
                    setNewBranchId('');
                  }}
                  className="input text-xs mt-1 font-semibold"
                >
                  <option value="">— Vyberte koncového klienta —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.companyId ? ` (IČO ${c.companyId})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-bold text-slate-700 block">
                Název zakázky *
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Např. Navigace poboček Ostrava & Frýdek-Místek"
                  className="input text-xs mt-1 font-bold"
                />
              </label>

              <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                <div className="text-xs font-extrabold text-violet-950">🤝 Agentura (volitelné)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Vybrat agenturu z CRM
                    <select
                      value={newAgencyClientId}
                      onChange={(e) => {
                        setNewAgencyClientId(e.target.value);
                        const found = clients.find((c) => c.id === e.target.value);
                        if (found) setNewAgencyName(found.name);
                      }}
                      className="input text-xs mt-1 bg-white"
                    >
                      <option value="">— Přímá zakázka —</option>
                      {agenciesList.length > 0 && (
                        <optgroup label="Agentury v CRM">
                          {agenciesList.map((ag) => (
                            <option key={ag.id} value={ag.id}>{ag.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {otherClientsList.length > 0 && (
                        <optgroup label="Ostatní firmy v CRM">
                          {otherClientsList.map((ag) => (
                            <option key={ag.id} value={ag.id}>{ag.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Název agentury (ruční)
                    <input
                      type="text"
                      value={newAgencyName}
                      onChange={(e) => setNewAgencyName(e.target.value)}
                      placeholder="Např. Knowlimits"
                      className="input text-xs mt-1 bg-white"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-xs font-bold text-slate-700">
                  Pobočka klienta
                  <select
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    disabled={selectedNewClientBranches.length === 0}
                    className="input text-xs mt-1"
                  >
                    <option value="">— Více / bez pobočky —</option>
                    {selectedNewClientBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.city ? ` (${b.city})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Typ projektu
                  <select
                    value={newProjectType}
                    onChange={(e) => setNewProjectType(e.target.value as CrmProjectType)}
                    className="input text-xs mt-1"
                  >
                    {(Object.entries(PROJECT_TYPE_LABELS) as [CrmProjectType, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Stav
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as CrmOrderStatus)}
                    className="input text-xs mt-1"
                  >
                    {(Object.entries(ORDER_STATUS_LABELS) as [CrmOrderStatus, { label: string }][]).map(([key, item]) => (
                      <option key={key} value={key}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="text-xs font-bold text-slate-700">
                  Cena zakázky (Kč)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newTotalPrice}
                    onChange={(e) => setNewTotalPrice(e.target.value)}
                    placeholder="0"
                    className="input text-xs mt-1 font-mono"
                  />
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Poznámka
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Fakturace / poznámka"
                    className="input text-xs mt-1"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Zrušit
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Zakládám...' : '➕ Založit zakázku'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
