'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';

export type ClientSimpleItem = {
  id: string;
  name: string;
  tradingName?: string | null;
  companyId?: string | null;
  email?: string | null;
  phone?: string | null;
};

export function AddClientModalButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI & ARES Lookup state
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);

  // Form inputs
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [billingCity, setBillingCity] = useState('');

  // Duplicates modal step
  const [duplicates, setDuplicates] = useState<ClientSimpleItem[]>([]);
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);
  const [canForceCreate, setCanForceCreate] = useState(false);

  const handleAiLookup = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiSuccessMsg(null);
    try {
      const res = await fetch('/api/crm/clients/ai-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery.trim() }),
      });
      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || 'Chyba při vyhledávání v ARES / AI.');
      } else if (resData.data) {
        const d = resData.data;
        if (d.name) setName(d.name);
        if (d.companyId) setCompanyId(d.companyId);
        if (d.billingCity) setBillingCity(d.billingCity);
        if (d.email) setEmail(d.email);
        if (d.phone) setPhone(d.phone);
        if (d.contactPerson) setContactPerson(d.contactPerson);

        setAiSuccessMsg(`Návrh pro „${d.name}“ byl předvyplněn. Před uložením údaje zkontrolujte.`);
      }
    } catch {
      alert('Chyba komunikace se serverem.');
    } finally {
      setAiLoading(false);
    }
  };

  const submitClient = async (forceCreate = false) => {
    setSaving(true);
    try {
      const res = await fetch('/api/crm/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          companyId,
          email,
          phone,
          contactPerson,
          billingCity,
          ignoreDuplicates: forceCreate || ignoreDuplicates,
        }),
      });

      const data = await res.json();
      if (res.status === 409 && data.hasDuplicates) {
        setDuplicates(data.duplicates || []);
        setCanForceCreate(Boolean(data.canForceCreate));
      } else if (res.ok && data.client) {
        setIsOpen(false);
        router.push(`/clients/${data.client.id}`);
      } else {
        alert(data.error || 'Chyba při zakládání klienta.');
      }
    } catch {
      alert('Chyba komunikace se serverem.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitClient();
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>➕ Nový Klient</Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-lg w-full bg-white space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold border-b pb-2 flex items-center gap-2">
              <span>➕</span> Založit Nového Klienta do CRM
            </h2>

            {/* Fast AI & ARES Pre-fill Box */}
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-sky-950">
                <Sparkles size={16} className="text-sky-600 shrink-0" />
                <span>ARES & AI předvyplnění k ruční kontrole</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Zadejte IČO (např. 25877698) nebo název (např. Canis)"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAiLookup();
                    }
                  }}
                  className="input text-xs flex-1 bg-white font-medium focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={handleAiLookup}
                  disabled={aiLoading || !aiQuery.trim()}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 disabled:opacity-50 shadow-xs"
                >
                  {aiLoading ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>Načíst AI</span>
                </button>
              </div>
              {aiSuccessMsg && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span>{aiSuccessMsg}</span>
                </div>
              )}
            </div>

            {duplicates.length > 0 && !ignoreDuplicates ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl">
                  <h3 className="font-bold text-amber-900 text-sm">⚠️ Nalezeny duplicitní záznamy v CRM!</h3>
                  <p className="text-xs text-amber-700 mt-1">V databázi již existují klienti se stejným IČO nebo názvem:</p>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {duplicates.map((dup: ClientSimpleItem) => (
                    <div key={dup.id} className="p-3 bg-slate-50 rounded-lg border flex items-center justify-between">
                      <div>
                        <a href={`/clients/${dup.id}`} target="_blank" rel="noreferrer" className="font-bold text-sm text-sky-600 hover:underline">
                          {dup.name}
                        </a>
                        <div className="text-xs text-slate-500">IČO: {dup.companyId || '-'} • E-mail: {dup.email || '-'}</div>
                      </div>
                      <a href={`/clients/${dup.id}`} target="_blank" rel="noreferrer" className="text-xs bg-sky-100 text-sky-800 font-semibold px-2.5 py-1 rounded">
                        Otevřít profil ↗
                      </a>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button type="button" variant="secondary" onClick={() => setDuplicates([])}>Zpět k formuláři</Button>
                  {canForceCreate ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="!bg-amber-600 !text-white hover:!bg-amber-700"
                      onClick={() => {
                        setIgnoreDuplicates(true);
                        void submitClient(true);
                      }}
                    >
                      I přesto vytvořit nového
                    </Button>
                  ) : (
                    <p className="max-w-64 text-xs text-amber-800">Klienta se stejným názvem nelze založit podruhé. Otevřete existující profil.</p>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="text-xs font-semibold">Název společnosti *
                  <input className="input text-sm mt-1 font-bold" placeholder="Např. Kofola ČeskoSlovensko a.s." value={name} onChange={e => setName(e.target.value)} required />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold">IČO<input className="input text-sm mt-1" placeholder="Např. 24261980" value={companyId} onChange={e => setCompanyId(e.target.value)} /></label>
                  <label className="text-xs font-semibold">Město (sídlo)<input className="input text-sm mt-1" placeholder="Např. Ostrava" value={billingCity} onChange={e => setBillingCity(e.target.value)} /></label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold">E-mail klienta<input className="input text-sm mt-1" type="email" placeholder="info@kofola.cz" value={email} onChange={e => setEmail(e.target.value)} /></label>
                  <label className="text-xs font-semibold">Telefon klienta<input className="input text-sm mt-1" placeholder="+420 800 100 100" value={phone} onChange={e => setPhone(e.target.value)} /></label>
                </div>
                <label className="text-xs font-semibold">Kontaktní osoba (primární)
                  <input className="input text-sm mt-1" placeholder="Např. Jan Novák (Marketingový ředitel)" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                </label>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Zrušit</Button>
                  <Button type="submit" disabled={saving}>{saving ? 'Ukládám...' : 'Vytvořit klienta'}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
