'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import {
  ORDER_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type CrmOrderRecordItem,
  type CrmOrderStatus,
  type CrmProjectType,
  type ClientProfileData,
  type CrmAgencyOption,
} from '@/lib/crm/types';

function toDateInput(value?: Date | string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function ClientOrdersTab({
  client,
  agencyOptions = [],
}: {
  client: ClientProfileData;
  agencyOptions?: CrmAgencyOption[];
}) {
  const router = useRouter();
  const orders = client.crmOrders || [];
  const agencyOrders = client.agencyCrmOrders || [];
  const branches = client.branches || [];

  const [editingOrder, setEditingOrder] = useState<CrmOrderRecordItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Shared modal state (create or edit)
  const [title, setTitle] = useState('');
  const [clientOrderCode, setClientOrderCode] = useState('');
  const [projectType, setProjectType] = useState<CrmProjectType>('COMBINED');
  const [status, setStatus] = useState<CrmOrderStatus>('CONFIRMED');
  const [agencyClientId, setAgencyClientId] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [note, setNote] = useState('');

  const { agenciesList, otherClientsList } = useMemo(() => {
    const filtered = agencyOptions.filter((opt) => opt.id !== client.id);
    const agencies = filtered.filter((opt) => opt.clientType === 'ADVERTISING_AGENCY' || opt.clientType === 'MEDIA_AGENCY');
    const others = filtered.filter((opt) => opt.clientType !== 'ADVERTISING_AGENCY' && opt.clientType !== 'MEDIA_AGENCY');
    return { agenciesList: agencies, otherClientsList: others };
  }, [agencyOptions, client.id]);

  const openCreateModal = () => {
    setEditingOrder(null);
    setTitle('');
    setClientOrderCode('');
    setProjectType('COMBINED');
    setStatus('CONFIRMED');
    setAgencyClientId('');
    setAgencyName('');
    setBranchId(branches.length === 1 ? branches[0].id : '');
    setDateFrom('');
    setDateTo('');
    setTotalPrice('');
    setNote('');
    setErrorMsg(null);
    setShowCreateModal(true);
  };

  const openEditModal = (order: CrmOrderRecordItem) => {
    setShowCreateModal(false);
    setEditingOrder(order);
    setTitle(order.title || '');
    setClientOrderCode(order.clientOrderCode || '');
    setProjectType(order.projectType || 'OTHER');
    setStatus(order.status || 'DRAFT');
    setAgencyClientId(order.agencyClientId || '');
    setAgencyName(order.agencyName || order.agencyClient?.name || '');
    setBranchId(order.branchId || '');
    setDateFrom(toDateInput(order.dateFrom));
    setDateTo(toDateInput(order.dateTo));
    setTotalPrice(order.totalPrice != null ? String(order.totalPrice) : '');
    setNote(order.note || '');
    setErrorMsg(null);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingOrder(null);
    setErrorMsg(null);
  };

  const handleAgencySelectChange = (selectedId: string) => {
    setAgencyClientId(selectedId);
    if (selectedId) {
      const found = agencyOptions.find((a) => a.id === selectedId);
      if (found) setAgencyName(found.name);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        ...(editingOrder ? {} : { clientId: client.id }),
        title: title.trim(),
        clientOrderCode: clientOrderCode.trim() || null,
        projectType,
        status,
        agencyClientId: agencyClientId || null,
        agencyName: agencyName.trim() || null,
        branchId: branchId || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        totalPrice: totalPrice.trim() ? Number(totalPrice.replace(/\s+/g, '').replace(',', '.')) : null,
        note: note.trim() || null,
      };

      const url = editingOrder ? `/api/crm/orders/${editingOrder.id}` : '/api/crm/orders';
      const method = editingOrder ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Zakázku se nepodařilo uložit.');
        return;
      }

      closeModal();
      router.refresh();
    } catch {
      setErrorMsg('Chyba komunikace se serverem.');
    } finally {
      setSaving(false);
    }
  };

  const isModalOpen = showCreateModal || Boolean(editingOrder);

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Zakázky a Kampaně ({orders.length})</h3>
            <p className="text-xs text-slate-500">
              Evidence zakázek pro koncového klienta včetně vazby na agenturu a pobočku.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button href="/clients/orders" variant="secondary" className="!text-xs">
              📋 Všechny zakázky & agentury
            </Button>
            <Button onClick={openCreateModal} className="!text-xs">
              ➕ Nová zakázka
            </Button>
          </div>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title="Žádné zakázky"
            description="Klient zatím nemá založenou žádnou zakázku. Můžete ji založit tlačítkem výše nebo převést z nabídky."
          />
        ) : (
          <Table minWidth="min-w-[1040px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Číslo zakázky / Název</TableHeaderCell>
                <TableHeaderCell>Agentura</TableHeaderCell>
                <TableHeaderCell>Pobočka</TableHeaderCell>
                <TableHeaderCell>Typ / Stav</TableHeaderCell>
                <TableHeaderCell>Cena zakázky</TableHeaderCell>
                <TableHeaderCell>Obchodník</TableHeaderCell>
                <TableHeaderCell>Realizace</TableHeaderCell>
                <TableHeaderCell className="text-right">Akce</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {orders.map((order: CrmOrderRecordItem) => {
                const statusObj =
                  ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || ORDER_STATUS_LABELS.DRAFT;
                const realizationBranches = Array.from(
                  new Set(
                    (order.realizations || [])
                      .map((r) => r.branch?.name)
                      .filter((v): v is string => Boolean(v))
                  )
                );

                return (
                  <tr key={order.id} className="hover:bg-slate-50/70">
                    <TableCell>
                      <div className="font-bold text-slate-900">{order.title}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {order.orderNumber}
                        {order.clientOrderCode ? ` · OBJ: ${order.clientOrderCode}` : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.agencyClient ? (
                        <a
                          href={`/clients/${order.agencyClient.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-xs font-bold text-violet-800 border border-violet-200 hover:bg-violet-100 transition"
                        >
                          🤝 {order.agencyClient.name}
                        </a>
                      ) : order.agencyName ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50/70 px-2 py-1 text-xs font-semibold text-violet-800 border border-violet-200/80">
                          🤝 {order.agencyName}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Přímá zakázka</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.branch ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800 border border-indigo-200">
                          🏬 {order.branch.name}
                          {order.branch.city ? ` (${order.branch.city})` : ''}
                        </span>
                      ) : realizationBranches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {realizationBranches.slice(0, 2).map((bName) => (
                            <span
                              key={bName}
                              className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200"
                            >
                              🏬 {bName}
                            </span>
                          ))}
                          {realizationBranches.length > 2 && (
                            <span className="text-[11px] text-slate-500">+{realizationBranches.length - 2} další</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Neuvedeno</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusObj.badge}`}>
                          {statusObj.label}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {PROJECT_TYPE_LABELS[order.projectType as keyof typeof PROJECT_TYPE_LABELS] || order.projectType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">
                      {order.totalPrice ? `${Number(order.totalPrice).toLocaleString('cs-CZ')} Kč` : '-'}
                    </TableCell>
                    <TableCell>{order.assignedUser?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit">
                          {order.realizations?.length || order._count?.realizations || 0} pozic
                        </span>
                        <span className="text-[11px] text-slate-500">{order._count?.workOrders || 0} příkazů</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(order)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                        >
                          ✏️ Upravit
                        </button>
                        {order.portalToken && (
                          <a
                            href={`/offer/${order.portalToken}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200 transition"
                            title="Otevřít veřejný živý portál kampaně"
                          >
                            🌐 Portál
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
      </div>

      {/* Orders where THIS client acts as the Agency */}
      {agencyOrders.length > 0 && (
        <div className="card space-y-4 border-violet-200/80 bg-violet-50/20">
          <div className="border-b border-violet-100 pb-3">
            <h3 className="font-bold text-violet-950 text-lg flex items-center gap-2">
              <span>🤝</span>
              <span>Zakázky koncových klientů přes tuto agenturu ({agencyOrders.length})</span>
            </h3>
            <p className="text-xs text-violet-700/80">
              Přehled zakázek, u kterých je tato společnost vedena jako zprostředkující / fakturační agentura.
            </p>
          </div>
          <Table minWidth="min-w-[850px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Číslo / Zakázka</TableHeaderCell>
                <TableHeaderCell>Koncový klient</TableHeaderCell>
                <TableHeaderCell>Pobočka</TableHeaderCell>
                <TableHeaderCell>Stav</TableHeaderCell>
                <TableHeaderCell>Cena</TableHeaderCell>
                <TableHeaderCell className="text-right">Detail</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {agencyOrders.map((order) => {
                const statusObj =
                  ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || ORDER_STATUS_LABELS.DRAFT;
                return (
                  <tr key={order.id} className="hover:bg-white/80">
                    <TableCell>
                      <div className="font-bold text-slate-900">{order.title}</div>
                      <div className="text-xs font-mono text-slate-500">{order.orderNumber}</div>
                    </TableCell>
                    <TableCell>
                      {order.client ? (
                        <a
                          href={`/clients/${order.client.id}?tab=orders`}
                          className="font-bold text-sky-700 hover:underline"
                        >
                          {order.client.name}
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {order.branch ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                          🏬 {order.branch.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusObj.badge}`}>
                        {statusObj.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold">
                      {order.totalPrice ? `${Number(order.totalPrice).toLocaleString('cs-CZ')} Kč` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.client && (
                        <a
                          href={`/clients/${order.client.id}?tab=orders`}
                          className="text-xs font-bold text-sky-700 hover:underline"
                        >
                          Otevřít klienta →
                        </a>
                      )}
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {/* Create / Edit Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-xl w-full bg-white space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingOrder ? `✏️ Upravit zakázku ${editingOrder.orderNumber}` : `➕ Nová zakázka pro ${client.name}`}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-800">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitOrder} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-xs font-bold text-slate-700 sm:col-span-2">
                  Název zakázky *
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Např. Podzimní navigace a CLV kampaň"
                    className="input text-xs mt-1 font-bold"
                  />
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Číslo obj. klienta
                  <input
                    type="text"
                    value={clientOrderCode}
                    onChange={(e) => setClientOrderCode(e.target.value)}
                    placeholder="Např. PO-2026-44"
                    className="input text-xs mt-1 font-mono"
                  />
                </label>
              </div>

              {/* Agency Section */}
              <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                <div className="text-xs font-extrabold text-violet-950 flex items-center gap-1.5">
                  <span>🤝</span>
                  <span>Agentura (volitelné — pokud zakázka běží přes mediální/reklamní agenturu)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Vybrat agenturu z CRM
                    <select
                      value={agencyClientId}
                      onChange={(e) => handleAgencySelectChange(e.target.value)}
                      className="input text-xs mt-1 bg-white"
                    >
                      <option value="">— Přímá zakázka (bez vazby na CRM agenturu) —</option>
                      {agenciesList.length > 0 && (
                        <optgroup label="Agentury v CRM">
                          {agenciesList.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.name}{ag.companyId ? ` (IČO ${ag.companyId})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherClientsList.length > 0 && (
                        <optgroup label="Ostatní firmy v CRM">
                          {otherClientsList.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.name}{ag.companyId ? ` (IČO ${ag.companyId})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Název agentury (ruční / z tabulky)
                    <input
                      type="text"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="Např. Knowlimits, PHD, Medea…"
                      className="input text-xs mt-1 bg-white"
                    />
                  </label>
                </div>
              </div>

              {/* Branch & Type & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-xs font-bold text-slate-700">
                  Výchozí pobočka klienta
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="input text-xs mt-1"
                  >
                    <option value="">— Více poboček / bez pobočky —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.city ? ` (${b.city})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Typ projektu
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value as CrmProjectType)}
                    className="input text-xs mt-1"
                  >
                    {(Object.entries(PROJECT_TYPE_LABELS) as [CrmProjectType, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Stav zakázky
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CrmOrderStatus)}
                    className="input text-xs mt-1"
                  >
                    {(Object.entries(ORDER_STATUS_LABELS) as [CrmOrderStatus, { label: string }][]).map(([key, item]) => (
                      <option key={key} value={key}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-xs font-bold text-slate-700">
                  Termín od
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-xs mt-1 font-mono" />
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Termín do
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-xs mt-1 font-mono" />
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Cena zakázky (Kč)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value)}
                    placeholder="0"
                    className="input text-xs mt-1 font-mono"
                  />
                </label>
              </div>

              <label className="text-xs font-bold text-slate-700 block">
                Poznámka k zakázce
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input text-xs mt-1"
                  placeholder="Doplňující poznámka, fakturační pokyny nebo specifikace poboček…"
                />
              </label>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Zrušit
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Ukládám...' : editingOrder ? '💾 Uložit změny' : '➕ Vytvořit zakázku'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
