'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building, Mail, Pencil, Phone, Plus, ShieldCheck, User } from 'lucide-react';

type ClientOption = { id: string; name: string };
type ContactItem = {
  id: string; clientId: string; client: { id: string; name: string }; contactType: string; name: string;
  agencyName?: string | null; role?: string | null; phone?: string | null; email?: string | null;
  isPrimary: boolean; note?: string | null;
};

const contactTypeLabels: Record<string, string> = {
  CLIENT: '👤 Klient', AGENCY: '🏢 Agentura', RESPONSIBLE_PERSON: '🛡️ Odpovědná osoba',
};

export function ContactPersonsManagementView({ initialContacts, total, clients }: {
  initialContacts: ContactItem[]; total: number; clients: ClientOption[];
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [contactType, setContactType] = useState('CLIENT');
  const [name, setName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!showModal) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setShowModal(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [showModal, saving]);

  function openNew() {
    setEditingId(null); setClientId(clients[0]?.id || ''); setContactType('CLIENT'); setName('');
    setAgencyName(''); setRole(''); setPhone(''); setEmail(''); setIsPrimary(false); setNote('');
    setMessage(''); setShowModal(true);
  }

  function openEdit(contact: ContactItem) {
    setEditingId(contact.id); setClientId(contact.clientId); setContactType(contact.contactType); setName(contact.name);
    setAgencyName(contact.agencyName || ''); setRole(contact.role || ''); setPhone(contact.phone || '');
    setEmail(contact.email || ''); setIsPrimary(contact.isPrimary); setNote(contact.note || '');
    setMessage(''); setShowModal(true);
  }

  async function saveContact(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const response = await fetch(editingId ? `/api/navigation/contacts/${editingId}` : '/api/navigation/contacts', {
        method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, contactType, name, agencyName, role, phone, email, isPrimary, note }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Uložení kontaktu selhalo.');
      setShowModal(false); router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Kontakt se nepodařilo uložit.');
    } finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="text-sm font-bold text-slate-700">Celkem kontaktních osob: <span className="font-black text-sky-700">{total}</span>{total > initialContacts.length ? ` (zobrazeno ${initialContacts.length})` : ''}</div>
      <button type="button" onClick={openNew} disabled={clients.length === 0} className="btn btn-primary inline-flex items-center gap-2 text-xs"><Plus size={16}/> Přidat kontaktní osobu</button>
    </div>
    {clients.length === 0 ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Nejprve vytvořte aktivního klienta.</p> : null}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{initialContacts.map((contact) => <article key={contact.id} className="relative space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
      {contact.isPrimary ? <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800"><ShieldCheck size={12}/> Hlavní kontakt</span> : null}
      <div className="space-y-1 pr-24"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{contactTypeLabels[contact.contactType] || contact.contactType}</span><h3 className="text-base font-extrabold text-slate-900">{contact.name}</h3>{contact.role ? <p className="text-xs font-bold text-sky-700">{contact.role}</p> : null}</div>
      <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs font-medium text-slate-700">
        <div className="flex items-center gap-2 font-bold text-slate-900"><Building size={14} className="text-slate-400"/><span>{contact.client.name}</span></div>
        {contact.agencyName ? <div className="flex items-center gap-2 text-slate-600"><span className="text-[11px] font-semibold text-slate-400">Agentura:</span><span className="font-bold text-slate-800">{contact.agencyName}</span></div> : null}
        {contact.phone ? <div className="flex items-center gap-2 font-bold"><Phone size={14} className="text-emerald-600"/><a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a></div> : null}
        {contact.email ? <div className="flex items-center gap-2 font-bold"><Mail size={14} className="text-sky-600"/><a href={`mailto:${contact.email}`} className="break-all hover:underline">{contact.email}</a></div> : null}
      </div>
      {contact.note ? <p className="text-xs text-slate-500">{contact.note}</p> : null}
      <button type="button" onClick={() => openEdit(contact)} className="btn btn-secondary inline-flex items-center gap-1 text-xs" aria-label={`Upravit kontakt ${contact.name}`}><Pencil size={14}/> Upravit</button>
    </article>)}
    {initialContacts.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center font-medium text-slate-500">Zatím nebyla přidána žádná kontaktní osoba.</div> : null}</div>

    {showModal ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs" onMouseDown={(event) => { if (event.currentTarget === event.target && !saving) setShowModal(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title" className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3"><h3 id="contact-dialog-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><User size={18} className="text-sky-600"/>{editingId ? 'Upravit kontaktní osobu' : 'Přidat kontaktní osobu'}</h3><button type="button" aria-label="Zavřít dialog" className="font-bold text-slate-400 hover:text-slate-700" onClick={() => setShowModal(false)}>✕</button></div>
        <form onSubmit={saveContact} className="space-y-3 text-xs">
          <Field label="Klient" id="contact-client"><select id="contact-client" className="input w-full" value={clientId} onChange={(e) => setClientId(e.target.value)} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Typ kontaktu" id="contact-type"><select id="contact-type" className="input w-full" value={contactType} onChange={(e) => setContactType(e.target.value)}><option value="CLIENT">Klient</option><option value="AGENCY">Agentura</option><option value="RESPONSIBLE_PERSON">Odpovědná osoba</option></select></Field><Field label="Jméno a příjmení" id="contact-name"><input id="contact-name" autoFocus className="input w-full" value={name} onChange={(e) => setName(e.target.value)} required maxLength={160}/></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Agentura" id="contact-agency"><input id="contact-agency" className="input w-full" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} maxLength={200}/></Field><Field label="Role / pozice" id="contact-role"><input id="contact-role" className="input w-full" value={role} onChange={(e) => setRole(e.target.value)} maxLength={160}/></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Telefon" id="contact-phone"><input id="contact-phone" className="input w-full" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40}/></Field><Field label="E-mail" id="contact-email"><input id="contact-email" className="input w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254}/></Field></div>
          <Field label="Interní poznámka" id="contact-note"><textarea id="contact-note" className="input min-h-20 w-full" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}/></Field>
          <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-700"><input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)}/> Hlavní kontaktní osoba klienta</label>
          {message ? <p role="alert" className="text-xs font-bold text-rose-600">{message}</p> : null}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" className="btn btn-secondary text-xs" onClick={() => setShowModal(false)} disabled={saving}>Zrušit</button><button type="submit" disabled={saving || !clientId} className="btn btn-primary text-xs">{saving ? 'Ukládám…' : editingId ? 'Uložit změny' : 'Uložit kontakt'}</button></div>
        </form>
      </div>
    </div> : null}
  </div>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1 block font-bold text-slate-700">{label}</label>{children}</div>;
}
