'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Mail, Pencil, Phone, Plus, ShieldAlert } from 'lucide-react';
import { deriveNavigationContractDisplay } from '@/lib/navigation/contract-policy';

type ClientOption = { id: string; name: string };
type ContractItem = {
  id: string; contractNumber: string; contractType: string; clientId: string;
  client: { id: string; name: string }; agencyName?: string | null; responsiblePerson?: string | null;
  phone?: string | null; email?: string | null; offerId?: string | null; navigationOrderId?: string | null;
  startDate: string; endDate: string; monthlyPrice?: number | null; totalPrice?: number | null;
  status: string; autoRenews: boolean; alertDaysBefore: number; note?: string | null;
};

const toneClasses: Record<string, string> = {
  slate: 'border-slate-200 bg-slate-100 text-slate-700', sky: 'border-sky-200 bg-sky-100 text-sky-800',
  rose: 'border-rose-200 bg-rose-100 text-rose-800', amber: 'border-amber-300 bg-amber-100 text-amber-900',
  emerald: 'border-emerald-200 bg-emerald-100 text-emerald-900', violet: 'border-violet-200 bg-violet-100 text-violet-800',
};

const dateValue = (value: string) => value.slice(0, 10);
const moneyValue = (value?: number | null) => value === null || value === undefined ? '' : String(value);

export function ContractManagementView({ initialContracts, total, clients, currentDate }: {
  initialContracts: ContractItem[]; total: number; clients: ClientOption[]; currentDate: string;
}) {
  const router = useRouter();
  const now = new Date(currentDate);
  const initialEnd = new Date(now);
  initialEnd.setUTCFullYear(initialEnd.getUTCFullYear() + 1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contractType, setContractType] = useState('RENTAL');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [agencyName, setAgencyName] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [offerId, setOfferId] = useState<string | null>(null);
  const [navigationOrderId, setNavigationOrderId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(now.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initialEnd.toISOString().slice(0, 10));
  const [monthlyPrice, setMonthlyPrice] = useState('1500');
  const [totalPrice, setTotalPrice] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [autoRenews, setAutoRenews] = useState(false);
  const [alertDaysBefore, setAlertDaysBefore] = useState('30');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!showModal) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setShowModal(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [showModal, saving]);

  const expiringContracts = initialContracts.filter((contract) => {
    const display = deriveNavigationContractDisplay(contract.status, contract.startDate, contract.endDate, contract.alertDaysBefore, now);
    return display.code === 'EXPIRING' || display.code === 'EXPIRED';
  });

  function openNew() {
    const suffix = globalThis.crypto?.randomUUID().slice(0, 6).toUpperCase() || String(Date.now()).slice(-6);
    setEditingId(null); setContractNumber(`NAV-${now.getUTCFullYear()}-${suffix}`); setContractType('RENTAL');
    setClientId(clients[0]?.id || ''); setAgencyName(''); setResponsiblePerson(''); setPhone(''); setEmail('');
    setOfferId(null); setNavigationOrderId(null); setStartDate(now.toISOString().slice(0, 10));
    setEndDate(initialEnd.toISOString().slice(0, 10)); setMonthlyPrice('1500'); setTotalPrice(''); setStatus('ACTIVE');
    setAutoRenews(false); setAlertDaysBefore('30'); setNote(''); setMessage(''); setShowModal(true);
  }

  function openEdit(contract: ContractItem) {
    setEditingId(contract.id); setContractNumber(contract.contractNumber); setContractType(contract.contractType);
    setClientId(contract.clientId); setAgencyName(contract.agencyName || ''); setResponsiblePerson(contract.responsiblePerson || '');
    setPhone(contract.phone || ''); setEmail(contract.email || ''); setOfferId(contract.offerId || null);
    setNavigationOrderId(contract.navigationOrderId || null); setStartDate(dateValue(contract.startDate)); setEndDate(dateValue(contract.endDate));
    setMonthlyPrice(moneyValue(contract.monthlyPrice)); setTotalPrice(moneyValue(contract.totalPrice)); setStatus(contract.status);
    setAutoRenews(contract.autoRenews); setAlertDaysBefore(String(contract.alertDaysBefore)); setNote(contract.note || '');
    setMessage(''); setShowModal(true);
  }

  async function saveContract(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const response = await fetch(editingId ? `/api/navigation/contracts/${editingId}` : '/api/navigation/contracts', {
        method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractNumber, contractType, clientId, agencyName, responsiblePerson, phone, email, offerId,
          navigationOrderId, startDate, endDate, monthlyPrice: monthlyPrice === '' ? null : Number(monthlyPrice),
          totalPrice: totalPrice === '' ? null : Number(totalPrice), status, autoRenews,
          alertDaysBefore: Number(alertDaysBefore), note,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Uložení smlouvy selhalo.');
      setShowModal(false); router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Smlouvu se nepodařilo uložit.');
    } finally { setSaving(false); }
  }

  return <div className="space-y-6">
    {expiringContracts.length > 0 ? <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xs">
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-amber-950">
        <ShieldAlert className="text-amber-600" size={18} /><span>{expiringContracts.length} smluv vyžaduje pozornost</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{expiringContracts.map((contract) => {
        const display = deriveNavigationContractDisplay(contract.status, contract.startDate, contract.endDate, contract.alertDaysBefore, now);
        return <div key={contract.id} className="space-y-1 rounded-xl border border-amber-200 bg-white p-3 text-xs shadow-2xs">
          <div className="flex justify-between gap-2 font-bold text-slate-900"><span>#{contract.contractNumber}</span><span className="text-amber-700">{display.label}</span></div>
          <div className="font-semibold text-slate-600">{contract.client.name}</div>
        </div>;
      })}</div>
    </div> : null}

    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="text-sm font-bold text-slate-700">Celkem smluv: <span className="font-black text-sky-700">{total}</span>{total > initialContracts.length ? ` (zobrazeno ${initialContracts.length})` : ''}</div>
      <button type="button" onClick={openNew} disabled={clients.length === 0} className="btn btn-primary inline-flex items-center gap-2 text-xs"><Plus size={16}/> Nová smlouva</button>
    </div>
    {clients.length === 0 ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Nejprve vytvořte aktivního klienta.</p> : null}

    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full min-w-[980px] text-left text-xs text-slate-700">
        <thead className="bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-white"><tr>
          <th className="p-3.5">Číslo</th><th className="p-3.5">Klient</th><th className="p-3.5">Typ</th><th className="p-3.5">Platnost</th>
          <th className="p-3.5">Cena</th><th className="p-3.5">Kontakt</th><th className="p-3.5">Stav</th><th className="p-3.5"><span className="sr-only">Akce</span></th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100 font-medium">{initialContracts.map((contract) => {
          const display = deriveNavigationContractDisplay(contract.status, contract.startDate, contract.endDate, contract.alertDaysBefore, now);
          return <tr key={contract.id} className="transition hover:bg-slate-50">
            <td className="p-3.5 font-mono font-bold text-sky-950">#{contract.contractNumber}</td>
            <td className="p-3.5 font-bold text-slate-900">{contract.client.name}{contract.agencyName ? <div className="text-[10px] font-normal text-slate-500">Agentura: {contract.agencyName}</div> : null}</td>
            <td className="p-3.5"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase">{contract.contractType}</span></td>
            <td className="p-3.5 font-semibold text-slate-800">{new Date(contract.startDate).toLocaleDateString('cs-CZ')} – {new Date(contract.endDate).toLocaleDateString('cs-CZ')}</td>
            <td className="p-3.5 font-bold text-slate-900">{contract.monthlyPrice !== null && contract.monthlyPrice !== undefined ? `${Math.round(contract.monthlyPrice).toLocaleString('cs-CZ')} Kč / měs.` : '—'}</td>
            <td className="space-y-0.5 p-3.5 text-[11px]">{contract.responsiblePerson ? <div className="font-bold text-slate-900">{contract.responsiblePerson}</div> : null}{contract.phone ? <div className="flex items-center gap-1"><Phone size={11}/>{contract.phone}</div> : null}{contract.email ? <div className="flex items-center gap-1"><Mail size={11}/>{contract.email}</div> : null}</td>
            <td className="p-3.5"><span className={`rounded-xl border px-2.5 py-1 text-[10px] font-black ${toneClasses[display.tone]}`}>{display.label}</span></td>
            <td className="p-3.5"><button type="button" onClick={() => openEdit(contract)} className="btn btn-secondary inline-flex items-center gap-1 text-xs" aria-label={`Upravit smlouvu ${contract.contractNumber}`}><Pencil size={14}/> Upravit</button></td>
          </tr>;
        })}{initialContracts.length === 0 ? <tr><td colSpan={8} className="p-8 text-center font-medium text-slate-400">Zatím nebyla evidována žádná smlouva.</td></tr> : null}</tbody>
      </table>
    </div>

    {showModal ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs" onMouseDown={(event) => { if (event.currentTarget === event.target && !saving) setShowModal(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="contract-dialog-title" className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3"><h3 id="contract-dialog-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><FileText size={18} className="text-sky-600"/>{editingId ? 'Upravit smlouvu' : 'Nová smlouva'}</h3><button type="button" aria-label="Zavřít dialog" className="font-bold text-slate-400 hover:text-slate-700" onClick={() => setShowModal(false)}>✕</button></div>
        <form onSubmit={saveContract} className="space-y-3 text-xs">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Číslo smlouvy" id="contract-number"><input id="contract-number" autoFocus className="input w-full" value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} required maxLength={80}/></Field><Field label="Typ smlouvy" id="contract-type"><select id="contract-type" className="input w-full" value={contractType} onChange={(e) => setContractType(e.target.value)}><option value="RENTAL">Nájemní</option><option value="PRODUCTION">Výrobní</option><option value="SERVICE">Servisní</option><option value="MASTER">Rámcová</option></select></Field></div>
          <Field label="Klient" id="contract-client"><select id="contract-client" className="input w-full" value={clientId} onChange={(e) => setClientId(e.target.value)} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Agentura" id="contract-agency"><input id="contract-agency" className="input w-full" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} maxLength={200}/></Field><Field label="Odpovědná osoba" id="contract-person"><input id="contract-person" className="input w-full" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)} maxLength={160}/></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Telefon" id="contract-phone"><input id="contract-phone" className="input w-full" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40}/></Field><Field label="E-mail" id="contract-email"><input id="contract-email" className="input w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254}/></Field></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Začátek" id="contract-start"><input id="contract-start" className="input w-full" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required/></Field><Field label="Konec" id="contract-end"><input id="contract-end" className="input w-full" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required/></Field><Field label="Měsíčně (Kč)" id="contract-monthly"><input id="contract-monthly" className="input w-full" type="number" min="0" step="0.01" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)}/></Field><Field label="Celkem (Kč)" id="contract-total"><input id="contract-total" className="input w-full" type="number" min="0" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)}/></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Stav" id="contract-status"><select id="contract-status" className="input w-full" value={status} onChange={(e) => setStatus(e.target.value)}><option value="DRAFT">Návrh</option><option value="ACTIVE">Aktivní</option><option value="EXPIRING">Končí</option><option value="EXPIRED">Vypršela</option><option value="TERMINATED">Ukončená</option></select></Field><Field label="Upozornit dní předem" id="contract-alert"><input id="contract-alert" className="input w-full" type="number" min="0" max="3650" value={alertDaysBefore} onChange={(e) => setAlertDaysBefore(e.target.value)} required/></Field></div>
          <Field label="Poznámka" id="contract-note"><textarea id="contract-note" className="input min-h-20 w-full" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000}/></Field>
          <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-700"><input type="checkbox" checked={autoRenews} onChange={(e) => setAutoRenews(e.target.checked)}/> Automaticky se prodlužuje</label>
          {message ? <p role="alert" className="text-xs font-bold text-rose-600">{message}</p> : null}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" className="btn btn-secondary text-xs" onClick={() => setShowModal(false)} disabled={saving}>Zrušit</button><button type="submit" disabled={saving || !clientId} className="btn btn-primary text-xs">{saving ? 'Ukládám…' : editingId ? 'Uložit změny' : 'Uložit smlouvu'}</button></div>
        </form>
      </div>
    </div> : null}
  </div>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1 block font-bold text-slate-700">{label}</label>{children}</div>;
}
