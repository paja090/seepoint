'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export function ClientLogoControl({
  clientId,
  clientName,
  logoUrl,
  compact = false,
}: {
  clientId: string;
  clientName: string;
  logoUrl?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');
    const form = new FormData();
    form.append('file', file);
    try {
      const response = await fetch(`/api/clients/${clientId}/logo`, { method: 'POST', body: form });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Logo se nepodařilo uložit.');
      if (input.current) input.current.value = '';
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Logo se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/clients/${clientId}/logo`, { method: 'DELETE' });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Logo se nepodařilo odstranit.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Logo se nepodařilo odstranit.');
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 shadow-2xs">
        {logoUrl ? (
          <Image alt={`Logo ${clientName}`} className="object-contain p-1" fill sizes="40px" src={logoUrl} unoptimized />
        ) : (
          clientName.slice(0, 2).toUpperCase()
        )}
      </span>
    );
  }

  return (
    <div className="flex min-w-48 items-center gap-3">
      <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 text-xs font-bold text-slate-300">
        {logoUrl ? (
          <Image alt={`Logo ${clientName}`} className="object-contain p-1" fill sizes="48px" src={logoUrl} unoptimized />
        ) : (
          clientName.slice(0, 2).toUpperCase()
        )}
      </span>
      <div className="space-y-1">
        <input
          ref={input}
          accept="image/jpeg,image/png,image/webp"
          aria-label={`Nahrát logo klienta ${clientName}`}
          className="block max-w-36 text-[11px]"
          disabled={busy}
          onChange={() => void upload()}
          type="file"
        />
        <div className="flex gap-2">
          {logoUrl && (
            <button className="text-[11px] font-semibold text-red-600" disabled={busy} onClick={() => void remove()} type="button">
              Odstranit
            </button>
          )}
          <span className="text-[11px] text-slate-400">max. 2 MB</span>
        </div>
        {message && (
          <p className="max-w-48 text-[11px] text-red-600" role="alert">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
