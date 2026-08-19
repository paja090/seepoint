'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableHead, TableHeaderCell, TableCell, EmptyState, Button } from '@/components/ui';
import { ClientBranchItem, ClientProfileData } from '@/lib/crm/types';
import { Edit3, Trash2, Plus, MapPin, Store } from 'lucide-react';

export function ClientBranchesTab({ client }: { client: ClientProfileData }) {
  const router = useRouter();
  const branches = client.branches || [];

  // Modal / Editing state
  const [editingBranch, setEditingBranch] = useState<ClientBranchItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [note, setNote] = useState('');

  const openCreateModal = () => {
    setEditingBranch(null);
    setName('');
    setCode('');
    setStreet('');
    setCity('Ostrava');
    setZip('');
    setNote('');
    setIsCreating(true);
  };

  const openEditModal = (b: ClientBranchItem) => {
    setEditingBranch(b);
    setName(b.name || '');
    setCode(b.code || '');
    setStreet(b.street || '');
    setCity(b.city || '');
    setZip(b.zip || '');
    setNote(b.note || '');
    setIsCreating(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingBranch
        ? `/api/crm/clients/${client.id}/branches/${editingBranch.id}`
        : `/api/crm/clients/${client.id}/branches`;
      const method = editingBranch ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code,
          street,
          city,
          zip,
          note,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Chyba při ukládání pobočky.');
      } else {
        setEditingBranch(null);
        setIsCreating(false);
        router.refresh();
      }
    } catch {
      alert('Chyba komunikace se serverem.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (branchId: string, branchName: string) => {
    if (!confirm(`Opravdu chcete smazat pobočku "${branchName}"?`)) return;
    try {
      const res = await fetch(`/api/crm/clients/${client.id}/branches/${branchId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Chyba při mazání pobočky.');
      }
    } catch {
      alert('Chyba komunikace se serverem.');
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Pobočky a Provozovny ({branches.length})</h3>
          <p className="text-xs text-slate-500">Adresy a cílové prodejny klienta pro projekt Navigace a lokální reklamu.</p>
        </div>
        <Button onClick={openCreateModal} className="flex items-center gap-1.5 text-xs font-bold">
          <Plus size={14} />
          <span>➕ Přidat novou pobočku</span>
        </Button>
      </div>

      {branches.length === 0 ? (
        <EmptyState title="Žádné pobočky" description="Klient zatím nemá evidované žádné pobočky. Přidejte první tlačítkem výše." />
      ) : (
        <Table minWidth="min-w-[700px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Kód / Název pobočky</TableHeaderCell>
              <TableHeaderCell>Ulice a číslo</TableHeaderCell>
              <TableHeaderCell>Město / PSČ</TableHeaderCell>
              <TableHeaderCell>Poznámka</TableHeaderCell>
              <TableHeaderCell>Akce</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {branches.map((b: ClientBranchItem) => (
              <tr key={b.id} className="hover:bg-slate-50/70">
                <TableCell>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Store size={15} className="text-amber-600 shrink-0" />
                    <span>{b.name}</span>
                  </div>
                  {b.code && <span className="text-xs text-slate-500 font-mono pl-5">{b.code}</span>}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-slate-900">{b.street || <span className="text-slate-400 font-normal">Neuvedeno</span>}</span>
                </TableCell>
                <TableCell>
                  {b.city ? (
                    <span className="flex items-center gap-1 font-medium text-slate-900">
                      <MapPin size={12} className="text-amber-600 shrink-0" />
                      <span>{b.city} {b.zip || ''}</span>
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell><span className="text-xs text-slate-500">{b.note || '-'}</span></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(b)}
                      className="px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 text-xs font-extrabold transition flex items-center gap-1.5 shadow-2xs"
                      title="Upravit adresu a údaje pobočky"
                    >
                      <Edit3 size={13} className="text-sky-700" />
                      <span>✏️ Upravit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(b.id, b.name)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition flex items-center gap-1"
                      title="Odstranit pobočku"
                    >
                      <Trash2 size={13} className="text-rose-600" />
                      <span>Smazat</span>
                    </button>
                  </div>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Edit / Create Branch Modal */}
      {(editingBranch || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900">
                {editingBranch ? '✏️ Upravit adresu & údaje pobočky' : '➕ Přidat novou pobočku klienta'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingBranch(null);
                  setIsCreating(false);
                }}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <label className="text-xs font-semibold">Název pobočky / prodejny *
                <input
                  type="text"
                  placeholder="Např. CANIS SAFETY - Prodejna Ostrava Hrabůvka"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="input text-xs mt-1 font-bold text-slate-900"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Ulice a číslo popisné *
                  <input
                    type="text"
                    placeholder="Např. Místecká 329/258"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="input text-xs mt-1 font-bold text-slate-900"
                  />
                </label>
                <label className="text-xs font-semibold">Kód pobočky
                  <input
                    type="text"
                    placeholder="Např. OST-01"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="input text-xs mt-1"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Město *
                  <input
                    type="text"
                    placeholder="Např. Ostrava"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="input text-xs mt-1 font-bold text-slate-900"
                  />
                </label>
                <label className="text-xs font-semibold">PSČ
                  <input
                    type="text"
                    placeholder="Např. 70030"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className="input text-xs mt-1 font-mono"
                  />
                </label>
              </div>

              <label className="text-xs font-semibold">Poznámka / Popis pobočky
                <input
                  type="text"
                  placeholder="Např. Hlavní velkosklad a prodejna pro Ostrava-Jih"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input text-xs mt-1"
                />
              </label>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingBranch(null);
                    setIsCreating(false);
                  }}
                >
                  Zrušit
                </Button>
                <Button type="submit" disabled={loading} className="font-bold">
                  {loading ? 'Ukládám...' : '💾 Uložit adresu pobočky'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
