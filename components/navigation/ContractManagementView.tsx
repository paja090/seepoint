'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Plus, FileText, Calendar, User, Phone, Mail, CheckCircle2, ShieldAlert } from 'lucide-react';

type ClientOption = { id: string; name: string };

type ContractItem = {
  id: string;
  contractNumber: string;
  contractType: string;
  clientId: string;
  client: { id: string; name: string };
  agencyName?: string | null;
  responsiblePerson?: string | null;
  phone?: string | null;
  email?: string | null;
  startDate: string;
  endDate: string;
  monthlyPrice?: number | null;
  totalPrice?: number | null;
  status: string;
  autoRenews: boolean;
  alertDaysBefore: number;
  note?: string | null;
};

export function ContractManagementView({
  initialContracts,
  clients,
}: {
  initialContracts: ContractItem[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form states
  const [contractNumber, setContractNumber] = useState(`SML-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [contractType, setContractType] = useState('RENTAL');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [agencyName, setAgencyName] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [monthlyPrice, setMonthlyPrice] = useState('1500');
  const [alertDaysBefore, setAlertDaysBefore] = useState('30');
  const [note, setNote] = useState('');

  const now = new Date();

  // Highlight expiring contracts
  const expiringContracts = initialContracts.filter((c) => {
    const end = new Date(c.endDate);
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= (c.alertDaysBefore || 30);
  });

  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/navigation/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractNumber,
          contractType,
          clientId,
          agencyName,
          responsiblePerson,
          phone,
          email,
          startDate,
          endDate,
          monthlyPrice: parseFloat(monthlyPrice) || 0,
          alertDaysBefore: parseInt(alertDaysBefore, 10) || 30,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vytvoření smlouvy selhalo');
      setShowModal(false);
      router.refresh();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Chyba uložení smlouvy');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Expiration Alert Banner */}
      {expiringContracts.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-950 font-black text-sm uppercase tracking-wider">
            <ShieldAlert className="text-amber-600" size={18} />
            <span>⚠️ Upozornění: {expiringContracts.length} smluv vyprší během 30 dní!</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {expiringContracts.map((c) => {
              const days = Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={c.id} className="rounded-xl border border-amber-200 bg-white p-3 text-xs space-y-1 shadow-2xs">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Smlouva #{c.contractNumber}</span>
                    <span className={days < 0 ? 'text-rose-600 font-black' : 'text-amber-600 font-black'}>
                      {days < 0 ? 'Vypršela' : `Za ${days} dní`}
                    </span>
                  </div>
                  <div className="text-slate-600 font-semibold">{c.client.name}</div>
                  <div className="text-[11px] text-slate-500">
                    Odpovědný: {c.responsiblePerson || '—'} • Tel: {c.phone || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-bold text-slate-700">
          Celkem smluv v evidenci: <span className="text-sky-700 font-black">{initialContracts.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-500 transition shadow-xs cursor-pointer"
        >
          <Plus size={16} /> Nová smlouva
        </button>
      </div>

      {/* Contracts Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="p-3.5">Číslo smlouvy</th>
              <th className="p-3.5">Klient / Provozovna</th>
              <th className="p-3.5">Typ smlouvy</th>
              <th className="p-3.5">Platnost (Od – Do)</th>
              <th className="p-3.5">Měsíční nájemné</th>
              <th className="p-3.5">Odpovědná osoba / Kontaktní údaje</th>
              <th className="p-3.5">Stav</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {initialContracts.map((c) => {
              const end = new Date(c.endDate);
              const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isExpiring = daysLeft <= (c.alertDaysBefore || 30) && daysLeft >= 0;
              const isExpired = daysLeft < 0;

              return (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="p-3.5 font-mono font-bold text-sky-950">#{c.contractNumber}</td>
                  <td className="p-3.5 font-bold text-slate-900">
                    {c.client.name}
                    {c.agencyName && <div className="text-[10px] text-slate-500 font-normal">Agentura: {c.agencyName}</div>}
                  </td>
                  <td className="p-3.5">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase text-slate-700">
                      {c.contractType}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="font-semibold text-slate-800">
                      {new Date(c.startDate).toLocaleDateString('cs-CZ')} – {new Date(c.endDate).toLocaleDateString('cs-CZ')}
                    </div>
                  </td>
                  <td className="p-3.5 font-bold text-slate-900">
                    {c.monthlyPrice ? `${Math.round(c.monthlyPrice).toLocaleString('cs-CZ')} Kč / měs.` : '—'}
                  </td>
                  <td className="p-3.5 space-y-0.5 text-[11px]">
                    {c.responsiblePerson && <div className="font-bold text-slate-900">{c.responsiblePerson}</div>}
                    {c.phone && <div className="text-slate-600 flex items-center gap-1"><Phone size={11} /> {c.phone}</div>}
                    {c.email && <div className="text-slate-600 flex items-center gap-1"><Mail size={11} /> {c.email}</div>}
                  </td>
                  <td className="p-3.5">
                    {isExpired ? (
                      <span className="rounded-xl bg-rose-100 px-2.5 py-1 text-[10px] font-black text-rose-800 border border-rose-200">
                        Vypršela
                      </span>
                    ) : isExpiring ? (
                      <span className="rounded-xl bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-900 border border-amber-300">
                        Končí за {daysLeft} dní
                      </span>
                    ) : (
                      <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-900 border border-emerald-200">
                        Aktivní
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {initialContracts.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                  Zatím nebyla evidována žádná smlouva. Klikněte na &quot;Nová smlouva&quot; pro přidání.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Contract Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-sky-600" /> Nová smlouva navigační reklamy
              </h3>
              <button type="button" className="text-slate-400 hover:text-slate-700 font-bold" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateContract} className="space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Číslo smlouvy</label>
                  <input className="input w-full" value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Typ smlouvy</label>
                  <select className="input w-full" value={contractType} onChange={(e) => setContractType(e.target.value)}>
                    <option value="RENTAL">Smlouva o nájmu (RENTAL)</option>
                    <option value="PRODUCTION">Smlouva o výrobě (PRODUCTION)</option>
                    <option value="SERVICE">Servisní smlouva (SERVICE)</option>
                    <option value="MASTER">Rámcová smlouva (MASTER)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Klient</label>
                <select className="input w-full" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Agentura (volitelné)</label>
                  <input className="input w-full" placeholder="Např. Media Agency s.r.o." value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Odpovědná osoba</label>
                  <input className="input w-full" placeholder="Jméno a příjmení" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telefon</label>
                  <input className="input w-full" placeholder="+420 777 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail</label>
                  <input className="input w-full" type="email" placeholder="jan.novak@firma.cz" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Datum začátku</label>
                  <input className="input w-full" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Datum konce</label>
                  <input className="input w-full" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Měsíční nájem (Kč)</label>
                  <input className="input w-full" type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
                </div>
              </div>

              {message && <p className="text-xs font-bold text-rose-600">{message}</p>}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowModal(false)}>Zrušit</button>
                <button type="submit" disabled={saving} className="btn btn-primary text-xs">
                  {saving ? 'Ukládám…' : 'Uložit smlouvu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
