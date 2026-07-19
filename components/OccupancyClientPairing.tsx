'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Edit2, Loader2, X } from 'lucide-react';

type ClientOption = { id: string; name: string };

export function OccupancyClientPairing({
  occupancyId,
  surfaceId,
  initialClientId,
  initialClientName,
  matchedClientName,
  clients,
}: {
  occupancyId: string;
  surfaceId: string;
  initialClientId: string | null;
  initialClientName: string | null;
  matchedClientName?: string | null;
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputValue, setInputValue] = useState(matchedClientName || initialClientName || '');
  const [error, setError] = useState('');

  // Find the selected client in the options list
  const currentClientName = matchedClientName || initialClientName;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const trimmedValue = inputValue.trim();
      
      // Match ID from clients list by exact case-insensitive match
      const matchedClient = clients.find(
        (c) => c.name.toLowerCase() === trimmedValue.toLowerCase()
      );

      const payload = {
        id: occupancyId,
        surfaceId,
        clientId: matchedClient ? matchedClient.id : null,
        clientName: trimmedValue || 'Klient',
      };

      const response = await fetch('/api/occupancy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || 'Nepodařilo se spárovat klienta.');
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se uložit.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <input
            className="input text-xs !py-1 !px-2 flex-1"
            list={`pairing-clients-${occupancyId}`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={saving}
            placeholder="Název klienta"
            autoFocus
          />
          <datalist id={`pairing-clients-${occupancyId}`}>
            {clients.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>

          <button
            type="button"
            className="rounded-lg p-1 hover:bg-slate-100 text-emerald-700 disabled:opacity-50"
            disabled={saving}
            onClick={handleSave}
            title="Uložit"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin text-slate-500" />
            ) : (
              <Check size={14} />
            )}
          </button>
          
          <button
            type="button"
            className="rounded-lg p-1 hover:bg-slate-100 text-red-600 disabled:opacity-50"
            disabled={saving}
            onClick={() => {
              setInputValue(currentClientName || '');
              setEditing(false);
              setError('');
            }}
            title="Zrušit"
          >
            <X size={14} />
          </button>
        </div>
        {error && <span className="text-[10px] text-red-600 leading-tight">{error}</span>}
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {initialClientId ? (
        <span className="font-semibold text-slate-900">{currentClientName}</span>
      ) : initialClientName ? (
        <div className="inline-flex items-center gap-1.5">
          <span className="font-medium text-slate-600">{initialClientName}</span>
          <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/10">
            nepárováno
          </span>
        </div>
      ) : (
        <span className="italic text-slate-400">Klient neurčen</span>
      )}
      
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 transition rounded-lg p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-900"
        onClick={() => setEditing(true)}
        title="Spárovat / upravit klienta"
      >
        <Edit2 size={12} />
      </button>
    </div>
  );
}
