'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, User, Phone, Mail, Building, ShieldCheck } from 'lucide-react';

type ClientOption = { id: string; name: string };

type ContactItem = {
  id: string;
  clientId: string;
  client: { id: string; name: string };
  contactType: string;
  name: string;
  agencyName?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
  note?: string | null;
};

export function ContactPersonsManagementView({
  initialContacts,
  clients,
}: {
  initialContacts: ContactItem[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [contactType, setContactType] = useState('CLIENT');
  const [name, setName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [role, setRole] = useState('Odpovědná osoba');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [note, setNote] = useState('');

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/navigation/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          contactType,
          name,
          agencyName,
          role,
          phone,
          email,
          isPrimary,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vytvoření kontaktu selhalo');
      setShowModal(false);
      setName('');
      setPhone('');
      setEmail('');
      router.refresh();
    } catch (err: any) {
      setMessage(err.message || 'Chyba uložení kontaktu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-bold text-slate-700">
          Celkem kontaktních osob: <span className="text-sky-700 font-black">{initialContacts.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-500 transition shadow-xs cursor-pointer"
        >
          <Plus size={16} /> Přidat kontaktní osobu
        </button>
      </div>

      {/* Contact Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialContacts.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 relative hover:shadow-md transition">
            {c.isPrimary && (
              <span className="absolute top-4 right-4 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck size={12} /> Hlavní kontakt
              </span>
            )}

            <div className="space-y-1">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                {c.contactType === 'AGENCY' ? '🏢 Agentura' : '👤 Klient'}
              </span>
              <h3 className="text-base font-extrabold text-slate-900">{c.name}</h3>
              {c.role && <p className="text-xs text-sky-700 font-bold">{c.role}</p>}
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-700 font-medium">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Building size={14} className="text-slate-400" />
                <span>{c.client.name}</span>
              </div>
              {c.agencyName && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-[11px] font-semibold text-slate-400">Agentura:</span>
                  <span className="font-bold text-slate-800">{c.agencyName}</span>
                </div>
              )}
              {c.phone && (
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <Phone size={14} className="text-emerald-600" />
                  <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a>
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <Mail size={14} className="text-sky-600" />
                  <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>
                </div>
              )}
            </div>
          </div>
        ))}

        {initialContacts.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 font-medium">
            Zatím nebyla přidána žádná kontaktní osoba. Klikněte na "Přidat kontaktní osobu".
          </div>
        )}
      </div>

      {/* New Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User size={18} className="text-sky-600" /> Přidat kontaktní osobu
              </h3>
              <button type="button" className="text-slate-400 hover:text-slate-700 font-bold" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3 text-xs">
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
                  <label className="block font-bold text-slate-700 mb-1">Typ kontaktu</label>
                  <select className="input w-full" value={contactType} onChange={(e) => setContactType(e.target.value)}>
                    <option value="CLIENT">Klient (Zákazník)</option>
                    <option value="AGENCY">Agentura (Zprostředkovatel)</option>
                    <option value="RESPONSIBLE_PERSON">Odpovědná osoba</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jméno a příjmení</label>
                  <input className="input w-full" placeholder="Jan Novák" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Agentura (název firmy)</label>
                  <input className="input w-full" placeholder="Např. OMD Czech" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role / Pozice</label>
                  <input className="input w-full" placeholder="Projektový manažer" value={role} onChange={(e) => setRole(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telefon</label>
                  <input className="input w-full" placeholder="+420 777 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail</label>
                  <input className="input w-full" type="email" placeholder="jan@novak.cz" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="isPrimary" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="rounded text-sky-600" />
                <label htmlFor="isPrimary" className="font-bold text-slate-700 cursor-pointer">Označit jako hlavní kontaktní osobu pro projekt</label>
              </div>

              {message && <p className="text-xs font-bold text-rose-600">{message}</p>}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowModal(false)}>Zrušit</button>
                <button type="submit" disabled={saving} className="btn btn-primary text-xs">
                  {saving ? 'Ukládám…' : 'Uložit kontakt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
