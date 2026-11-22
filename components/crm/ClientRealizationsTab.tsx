'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import {
  REALIZATION_STATUS_LABELS,
  type CrmRealizationRecordItem,
  type ClientProfileData,
} from '@/lib/crm/types';

export function ClientRealizationsTab({ client }: { client: ClientProfileData }) {
  const router = useRouter();
  const branches = useMemo(() => client.branches || [], [client.branches]);

  // Flatten realizations across all orders of this client
  const allRealizations = useMemo<CrmRealizationRecordItem[]>(
    () =>
      (client.crmOrders || []).flatMap((o) =>
        (o.realizations || []).map((r) => ({
          ...r,
          crmOrderId: r.crmOrderId ?? o.id,
          orderNumber: r.orderNumber ?? o.orderNumber,
          orderTitle: r.orderTitle ?? o.title,
          orderAgencyLabel: r.orderAgencyLabel ?? o.agencyClient?.name ?? o.agencyName ?? null,
        }))
      ),
    [client.crmOrders]
  );

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Photo upload modal state
  const [uploadTarget, setUploadTarget] = useState<CrmRealizationRecordItem | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBranchId, setUploadBranchId] = useState<string>('');
  const [uploadType, setUploadType] = useState<string>('AFTER_INSTALLATION');
  const [uploadNote, setUploadNote] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  const filteredRealizations = useMemo(() => {
    if (selectedBranchFilter === 'ALL') return allRealizations;
    if (selectedBranchFilter === 'UNASSIGNED') {
      return allRealizations.filter((r) => !r.branchId);
    }
    return allRealizations.filter(
      (r) =>
        r.branchId === selectedBranchFilter ||
        (r.photos || []).some((ph) => ph.branchId === selectedBranchFilter)
    );
  }, [allRealizations, selectedBranchFilter]);

  const branchStats = useMemo(() => {
    const map = new Map<string, { positions: number; photos: number }>();
    for (const b of branches) {
      map.set(b.id, { positions: 0, photos: 0 });
    }
    let unassignedPositions = 0;
    for (const r of allRealizations) {
      if (r.branchId && map.has(r.branchId)) {
        map.get(r.branchId)!.positions += 1;
      } else if (!r.branchId) {
        unassignedPositions += 1;
      }
      for (const ph of r.photos || []) {
        const effBranch = ph.branchId || r.branchId;
        if (effBranch && map.has(effBranch)) {
          map.get(effBranch)!.photos += 1;
        }
      }
    }
    return { map, unassignedPositions };
  }, [allRealizations, branches]);

  const handleAssignRealizationBranch = async (realizationId: string, nextBranchId: string) => {
    setSavingId(realizationId);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/crm/realizations/${realizationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: nextBranchId || null,
          propagateToPhotos: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Nepodařilo se přiřadit pobočku.');
        return;
      }
      setStatusMessage('Pobočka pozice (včetně navázaného příkazu a fotek) byla uložena.');
      router.refresh();
    } catch {
      alert('Chyba komunikace se serverem.');
    } finally {
      setSavingId(null);
    }
  };

  const handleAssignPhotoBranch = async (realizationId: string, photoId: string, nextBranchId: string) => {
    setSavingId(photoId);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/crm/realizations/${realizationId}/photos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId,
          branchId: nextBranchId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Nepodařilo se změnit pobočku fotografie.');
        return;
      }
      setStatusMessage('Pobočka fotografie byla aktualizována.');
      router.refresh();
    } catch {
      alert('Chyba komunikace se serverem.');
    } finally {
      setSavingId(null);
    }
  };

  const openUploadModal = (r: CrmRealizationRecordItem) => {
    setUploadTarget(r);
    setUploadFile(null);
    setUploadBranchId(r.branchId || (branches.length === 1 ? branches[0].id : ''));
    setUploadType('AFTER_INSTALLATION');
    setUploadNote('');
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTarget || !uploadFile) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('type', uploadType);
      if (uploadBranchId) form.append('branchId', uploadBranchId);
      if (uploadNote.trim()) form.append('note', uploadNote.trim());

      const res = await fetch(`/api/crm/realizations/${uploadTarget.id}/photos`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Nahrání fotografie se nezdařilo.');
        return;
      }
      setUploadTarget(null);
      setUploadFile(null);
      setStatusMessage('Fotografie byla nahrána a přiřazena k pozici / pobočce.');
      router.refresh();
    } catch {
      alert('Chyba komunikace se serverem.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">
            Realizace a Fotodokumentace ({filteredRealizations.length}
            {selectedBranchFilter !== 'ALL' ? ` z ${allRealizations.length}` : ''})
          </h3>
          <p className="text-xs text-slate-500">
            Přiřazení jednotlivých pozic a fotodokumentace ke konkrétním pobočkám klienta.
          </p>
        </div>
        {statusMessage && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            ✓ {statusMessage}
          </div>
        )}
      </div>

      {/* Branch filter pills */}
      {branches.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-50 p-2.5 border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 px-1.5">
            Filtr poboček:
          </span>
          <button
            type="button"
            onClick={() => setSelectedBranchFilter('ALL')}
            className={`rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer ${
              selectedBranchFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Vše ({allRealizations.length})
          </button>
          {branches.map((b) => {
            const stats = branchStats.map.get(b.id) ?? { positions: 0, photos: 0 };
            const active = selectedBranchFilter === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBranchFilter(b.id)}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50'
                }`}
              >
                <span>🏬 {b.name}</span>
                <span className={`text-[10px] font-mono ${active ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {stats.positions} poz. · {stats.photos} foto
                </span>
              </button>
            );
          })}
          {branchStats.unassignedPositions > 0 && (
            <button
              type="button"
              onClick={() => setSelectedBranchFilter('UNASSIGNED')}
              className={`rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer ${
                selectedBranchFilter === 'UNASSIGNED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Bez pobočky ({branchStats.unassignedPositions})
            </button>
          )}
        </div>
      )}

      {filteredRealizations.length === 0 ? (
        <EmptyState
          title="Žádné realizace"
          description={
            selectedBranchFilter === 'ALL'
              ? 'Zatím nebyla evidována žádná realizace.'
              : 'Pro vybranou pobočku zatím nejsou přiřazeny žádné realizační pozice.'
          }
        />
      ) : (
        <Table minWidth="min-w-[1040px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Pozice / Zakázka</TableHeaderCell>
              <TableHeaderCell>Pobočka</TableHeaderCell>
              <TableHeaderCell>Stav realizace</TableHeaderCell>
              <TableHeaderCell>Termíny</TableHeaderCell>
              <TableHeaderCell>Fotodokumentace</TableHeaderCell>
              <TableHeaderCell>Technik / Poznámka</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {filteredRealizations.map((r: CrmRealizationRecordItem) => {
              const statusObj =
                REALIZATION_STATUS_LABELS[r.status as keyof typeof REALIZATION_STATUS_LABELS] ||
                REALIZATION_STATUS_LABELS.WAITING_FOR_MATERIALS;
              const carrier = r.carrier || r.surface?.carrier;
              const positionTitle = carrier
                ? `${carrier.code} · ${carrier.name}`
                : r.surface?.name || r.note || `Pozice ${r.id.slice(-6)}`;
              const photos = (r.photos || []).filter((ph) => {
                if (selectedBranchFilter === 'ALL' || selectedBranchFilter === 'UNASSIGNED') return true;
                return (ph.branchId || r.branchId) === selectedBranchFilter;
              });

              return (
                <tr key={r.id} className="hover:bg-slate-50/70 align-top">
                  <TableCell>
                    <div className="font-bold text-slate-900">{positionTitle}</div>
                    {r.surface?.name && carrier && (
                      <div className="text-xs text-slate-600">Plocha: {r.surface.name}</div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {r.orderNumber && <span className="font-mono font-semibold">{r.orderNumber}</span>}
                      {r.orderTitle && <span className="truncate max-w-[200px]">· {r.orderTitle}</span>}
                      {r.orderAgencyLabel && (
                        <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 border border-violet-200">
                          🤝 {r.orderAgencyLabel}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {branches.length > 0 ? (
                      <select
                        value={r.branchId || ''}
                        disabled={savingId === r.id}
                        onChange={(e) => void handleAssignRealizationBranch(r.id, e.target.value)}
                        aria-label={`Pobočka pro pozici ${positionTitle}`}
                        className="input !py-1 !px-2 text-xs min-w-[170px] bg-white"
                      >
                        <option value="">— Nepřiřazeno k pobočce —</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            🏬 {b.name}{b.city ? ` (${b.city})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <a
                        href={`/clients/${client.id}?tab=branches`}
                        className="text-xs text-indigo-700 hover:underline"
                      >
                        + Založit pobočky
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${statusObj.badge}`}>
                      {statusObj.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-700">
                      <span className="text-slate-400">Plán:</span>{' '}
                      {r.plannedDate ? new Date(r.plannedDate).toLocaleDateString('cs-CZ') : '-'}
                    </div>
                    <div className="text-xs text-slate-700">
                      <span className="text-slate-400">Hotovo:</span>{' '}
                      {r.actualDate ? new Date(r.actualDate).toLocaleDateString('cs-CZ') : '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2 min-w-[220px]">
                      <div className="flex flex-wrap gap-2">
                        {photos.map((ph) => (
                          <div
                            key={ph.id}
                            className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs w-[112px] space-y-1"
                          >
                            <a href={ph.url} target="_blank" rel="noreferrer" title={ph.fileName}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/photos/${encodeURIComponent(ph.id)}/thumbnail`}
                                alt={ph.fileName}
                                className="h-16 w-full rounded-lg object-cover bg-slate-100"
                              />
                            </a>
                            {branches.length > 0 ? (
                              <select
                                value={ph.branchId || ''}
                                disabled={savingId === ph.id}
                                onChange={(e) => void handleAssignPhotoBranch(r.id, ph.id, e.target.value)}
                                aria-label={`Pobočka fotografie ${ph.fileName}`}
                                className="w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-medium text-slate-700"
                              >
                                <option value="">Bez pobočky</option>
                                {branches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="truncate text-[10px] text-slate-500">{ph.fileName}</div>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => openUploadModal(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800 hover:bg-sky-100 transition cursor-pointer"
                      >
                        📷 Nahrát foto{r.branch ? ` (${r.branch.name})` : ''}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-semibold text-slate-800">{r.assignedUser?.name || '-'}</div>
                    {(r.note || r.claimNote) && (
                      <div className="mt-0.5 text-xs text-slate-500 max-w-[200px]">{r.claimNote || r.note}</div>
                    )}
                  </TableCell>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Upload Photo Modal */}
      {uploadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-base text-slate-900">📷 Nahrát fotku k realizaci</h3>
              <button
                type="button"
                onClick={() => setUploadTarget(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUploadPhoto} className="space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                <strong>Zakázka:</strong> {uploadTarget.orderNumber} · {uploadTarget.orderTitle}
              </div>

              {branches.length > 0 && (
                <label className="text-xs font-bold text-slate-700 block">
                  Přiřadit k pobočce
                  <select
                    value={uploadBranchId}
                    onChange={(e) => setUploadBranchId(e.target.value)}
                    className="input text-xs mt-1"
                  >
                    <option value="">— Bez přiřazení ke konkrétní pobočce —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        🏬 {b.name}{b.city ? ` (${b.city})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-xs font-bold text-slate-700 block">
                Typ fotografie
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="input text-xs mt-1"
                >
                  <option value="AFTER_INSTALLATION">Po instalaci / realizaci</option>
                  <option value="INSTALLATION">Během instalace</option>
                  <option value="CONTROL">Kontrolní foto</option>
                  <option value="AFTER_DEINSTALLATION">Po demontáži</option>
                  <option value="DAMAGE">Závada / reklamace</option>
                </select>
              </label>

              <label className="text-xs font-bold text-slate-700 block">
                Soubor fotografie *
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="input text-xs mt-1"
                />
              </label>

              <label className="text-xs font-bold text-slate-700 block">
                Poznámka k fotografii
                <input
                  type="text"
                  value={uploadNote}
                  onChange={(e) => setUploadNote(e.target.value)}
                  placeholder="Např. Pohled z příjezdu ke vchodu pobočky"
                  className="input text-xs mt-1"
                />
              </label>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setUploadTarget(null)}>
                  Zrušit
                </Button>
                <Button type="submit" disabled={uploading || !uploadFile}>
                  {uploading ? 'Nahrávám...' : '📷 Nahrát fotografii'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
