'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

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
            <h2 className="text-xl font-bold border-b pb-2">➕ Založit Nového Klienta do CRM</h2>

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
                  {canForceCreate ? <Button
                      type="button"
                      variant="secondary"
                      className="!bg-amber-600 !text-white hover:!bg-amber-700"
                      onClick={() => {
                        setIgnoreDuplicates(true);
                        void submitClient(true);
                      }}
                    >
                      I přesto vytvořit nového
                    </Button> : <p className="max-w-64 text-xs text-amber-800">Klienta se stejným názvem nelze založit podruhé. Otevřete existující profil.</p>}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="text-xs font-semibold">Název společnosti *
                  <input className="input text-sm mt-1" placeholder="Např. Kofola ČeskoSlovensko a.s." value={name} onChange={e => setName(e.target.value)} required />
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
