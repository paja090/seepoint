'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, Trash2, Truck, Search, CheckCircle2, ArrowRight } from 'lucide-react';

interface NewFieldActionProps {
  clients?: Array<{ id: string; name: string }>;
}

export function NewFieldAction({ clients = [] }: NewFieldActionProps) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<'INSTALLATION' | 'REMOVAL' | 'RELOCATION' | 'INSPECTION'>('INSTALLATION');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const purposeOptions = [
    {
      id: 'INSTALLATION',
      title: 'Instalace & Montáž',
      badge: 'Montáž nosičů / výlep / bannery',
      icon: Wrench,
      defaultOp: 'INSTALL_AD',
      placeholderName: 'Montáž reklamních nosičů a bannerů',
    },
    {
      id: 'REMOVAL',
      title: 'Deinstalace & Demontáž',
      badge: 'Odstranění / úklid / odvoz na sklad',
      icon: Trash2,
      defaultOp: 'REMOVE_AD',
      placeholderName: 'Deinstalace a demontáž po ukončení kampaně',
    },
    {
      id: 'RELOCATION',
      title: 'Přesun & Přemístění',
      badge: 'Převoz z místa A na místo B',
      icon: Truck,
      defaultOp: 'RELOCATION',
      placeholderName: 'Přesun konstrukcí na nové lokality',
    },
    {
      id: 'INSPECTION',
      title: 'Kontrola & Servis',
      badge: 'Revize stavu, oprava nebo fotodokumentace',
      icon: Search,
      defaultOp: 'INSPECTION',
      placeholderName: 'Kontrola stavu a fotodokumentace',
    },
  ] as const;

  const currentOption = purposeOptions.find((o) => o.id === purpose) || purposeOptions[0];

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const form = new FormData(e.currentTarget);
        const name = String(form.get('name') || '').trim();
        const clientName = String(form.get('clientName') || '').trim();
        const targetDate = String(form.get('targetDate') || '').trim();
        const description = String(form.get('description') || '').trim();

        try {
          const r = await fetch('/api/election-removal/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              clientName: clientName || null,
              targetDate: targetDate ? new Date(targetDate).toISOString() : null,
              description: description || null,
              mediaDefaults: {
                purpose,
                defaultOperation: currentOption.defaultOp,
              },
              points: [],
            }),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Založení zakázky selhalo.');
          router.push('/election-removal/' + data.campaignId);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Založení zakázky selhalo.');
        } finally {
          setBusy(false);
        }
      }}
    >
      {/* Krok 1: Účel zakázky */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold">
            1
          </span>
          <h2 className="text-base font-bold text-slate-900">
            Účel zakázky (Co se bude v terénu provádět?)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {purposeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = purpose === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPurpose(opt.id)}
                className={`text-left p-4 rounded-xl border-2 transition relative flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? 'border-sky-600 bg-sky-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-sky-600" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{opt.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.badge}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Krok 2: Základní údaje zakázky */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold">
            2
          </span>
          <h2 className="text-base font-bold text-slate-900">
            Podrobnosti a termín zakázky
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Název zakázky / akce *
            </label>
            <input
              className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
              name="name"
              required
              placeholder={currentOption.placeholderName}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Klient / Zadavatel
            </label>
            <input
              list="clients-list"
              className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
              name="clientName"
              placeholder="Např. BILLA, Lidl, Město Ostrava..."
            />
            {clients.length > 0 && (
              <datalist id="clients-list">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Termín realizace *
            </label>
            <input
              className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
              name="targetDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Společné instrukce pro montéry
            </label>
            <textarea
              rows={2}
              className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
              name="description"
              placeholder="Např. Vyzvednout klíče na centrále, pořídit foto před i po montáži..."
            />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      <div className="pt-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          V dalším kroku zadáte body v mapě nebo nahrajete soubor KML/Excel.
        </p>
        <button
          disabled={busy}
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-2.5 text-sm shadow-sm transition disabled:opacity-50"
        >
          <span>{busy ? 'Zakládám…' : 'Založit zakázku a pokračovat'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
