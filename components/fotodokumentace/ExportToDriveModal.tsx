'use client';

import { useState, useEffect } from 'react';
import {
  FolderUp,
  FolderPlus,
  ExternalLink,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';

export interface ExportToDriveResult {
  folderId: string;
  folderName: string;
  folderUrl: string;
  tokenSource?: 'service-account' | 'env-oauth' | 'tenant-oauth' | 'mock';
  isSharedDrive?: boolean;
  driveLabel?: string | null;
  sheetSynced?: boolean;
  totalPhotos: number;
  uploadedCount: number;
  skippedCount: number;
  failedCount: number;
  updatedWorkOrderFtdUrl?: string | null;
  message: string;
}

export interface ExportToDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  clientName?: string | null;
  photosCount: number;
  photoIds?: string[];
  workOrderId?: string | null;
  albumId?: string | null;
  source?: string | null;
  defaultTargetUrl?: string | null;
  lastExportedFolderUrl?: string | null;
  onExported?: (result: ExportToDriveResult) => void;
}

export function ExportToDriveModal({
  isOpen,
  onClose,
  title,
  clientName,
  photosCount,
  photoIds,
  workOrderId,
  albumId,
  source,
  defaultTargetUrl,
  lastExportedFolderUrl,
  onExported,
}: ExportToDriveModalProps) {
  const [targetFolderUrl, setTargetFolderUrl] = useState(defaultTargetUrl || lastExportedFolderUrl || '');
  const [newFolderName, setNewFolderName] = useState(
    clientName ? `${title} - ${clientName}` : title
  );
  const [saveTargetUrlToWorkOrder, setSaveTargetUrlToWorkOrder] = useState(Boolean(workOrderId));
  const [markFtdSent, setMarkFtdSent] = useState(false);

  const [submittingMode, setSubmittingMode] = useState<'EXISTING_OR_SEARCH' | 'CREATE_NEW' | null>(null);
  const [result, setResult] = useState<ExportToDriveResult | null>(null);
  const [errorState, setErrorState] = useState<{
    message: string;
    code?: string;
    canCreateNewFolder?: boolean;
    serviceAccountEmail?: string | null;
  } | null>(null);
  const [copiedSaEmail, setCopiedSaEmail] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetFolderUrl(defaultTargetUrl || lastExportedFolderUrl || '');
      setNewFolderName(clientName ? `${title} - ${clientName}` : title);
      setResult(null);
      setErrorState(null);
    }
  }, [isOpen, defaultTargetUrl, lastExportedFolderUrl, title, clientName]);

  if (!isOpen) return null;

  const runExport = async (mode: 'EXISTING_OR_SEARCH' | 'CREATE_NEW') => {
    setSubmittingMode(mode);
    setErrorState(null);
    setResult(null);

    try {
      const res = await fetch('/api/fotodokumentace/export-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          workOrderId: workOrderId || undefined,
          albumId: albumId || undefined,
          source: source || undefined,
          photoIds: photoIds && photoIds.length > 0 ? photoIds : undefined,
          targetFolderUrl: mode === 'EXISTING_OR_SEARCH' ? targetFolderUrl.trim() : undefined,
          newFolderName: mode === 'CREATE_NEW' ? newFolderName.trim() : undefined,
          saveTargetUrlToWorkOrder: Boolean(workOrderId && saveTargetUrlToWorkOrder),
          markFtdSent: Boolean(workOrderId && markFtdSent),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<ExportToDriveResult> & {
        error?: string;
        code?: string;
        canCreateNewFolder?: boolean;
        serviceAccountEmail?: string | null;
      };

      if (!res.ok) {
        setErrorState({
          message: data.error || 'Odeslání na Google Disk se nezdařilo.',
          code: data.code,
          canCreateNewFolder: data.canCreateNewFolder,
          serviceAccountEmail: data.serviceAccountEmail,
        });
        return;
      }

      const successResult: ExportToDriveResult = {
        folderId: data.folderId || '',
        folderName: data.folderName || newFolderName,
        folderUrl: data.folderUrl || '',
        tokenSource: data.tokenSource,
        isSharedDrive: data.isSharedDrive,
        driveLabel: data.driveLabel,
        sheetSynced: data.sheetSynced,
        totalPhotos: data.totalPhotos ?? photosCount,
        uploadedCount: data.uploadedCount ?? 0,
        skippedCount: data.skippedCount ?? 0,
        failedCount: data.failedCount ?? 0,
        updatedWorkOrderFtdUrl: data.updatedWorkOrderFtdUrl,
        message: data.message || 'Fotografie byly odeslány na Google Disk.',
      };

      setResult(successResult);
      if (successResult.folderUrl) {
        setTargetFolderUrl(successResult.folderUrl);
      }
      onExported?.(successResult);
    } catch (err) {
      setErrorState({
        message: err instanceof Error ? err.message : 'Chyba sítě při odesílání na Google Disk.',
      });
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleCopySaEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedSaEmail(true);
      setTimeout(() => setCopiedSaEmail(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const isBusy = submittingMode !== null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => !isBusy && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-emerald-700 font-black text-xs uppercase tracking-wider">
              <FolderUp className="w-4 h-4" />
              <span>Export do firemního Google Disku</span>
            </div>
            <h3 className="text-base font-black text-slate-900 mt-0.5 truncate">{title}</h3>
            <p className="text-xs text-slate-500">
              Připraveno k odeslání: <strong>{photosCount}</strong>{' '}
              {photosCount === 1 ? 'fotografie' : photosCount >= 2 && photosCount <= 4 ? 'fotografie' : 'fotografií'}
              {clientName ? ` · ${clientName}` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {photosCount === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 font-medium">
              Toto album zatím neobsahuje žádné fotografie. Nejprve pořiďte fotky v mobilní aplikaci nebo je nahrajte z počítače.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Cílová složka na firemním Google Disku (odkaz URL, ID nebo název z Plánu práce)
                </label>
                <input
                  type="text"
                  value={targetFolderUrl}
                  onChange={(e) => setTargetFolderUrl(e.target.value)}
                  disabled={isBusy}
                  placeholder="https://drive.google.com/drive/folders/... nebo název složky"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                />
                <p className="text-[11px] text-slate-500">
                  Přednostně se zapisuje přímo do složky z Plánu práce na firemním Disku. Duplicitní fotky se automaticky přeskakují.
                </p>
              </div>

              {workOrderId && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={saveTargetUrlToWorkOrder}
                      onChange={(e) => setSaveTargetUrlToWorkOrder(e.target.checked)}
                      disabled={isBusy}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Uložit odkaz na cílovou složku k zakázce i do Google Tabulky Plán (Odkaz FTD)</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={markFtdSent}
                      onChange={(e) => setMarkFtdSent(e.target.checked)}
                      disabled={isBusy}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Označit zakázku jako „FTD odesláno = ANO“ (připraveno k fakturaci + zápis do Plánu)</span>
                  </label>
                </div>
              )}

              {/* Success Result */}
              {result && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 space-y-2">
                  <div className="flex items-start gap-2 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-bold">{result.message}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {result.driveLabel && (
                          <span className="inline-flex items-center rounded-md bg-white/90 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                            {result.tokenSource === 'service-account' || result.isSharedDrive ? '🏢 ' : '👤 '}
                            {result.driveLabel}
                          </span>
                        )}
                        {result.sheetSynced && (
                          <span className="inline-flex items-center rounded-md bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                            ✓ Zapsáno i do Google Tabulky Plán
                          </span>
                        )}
                      </div>
                      {result.failedCount > 0 && (
                        <p className="text-amber-800">
                          {result.failedCount} fotografií se nepodařilo přenést.
                        </p>
                      )}
                    </div>
                  </div>
                  {result.folderUrl && (
                    <a
                      href={result.folderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs"
                    >
                      <span>Otevřít složku na Google Disku</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Error & Fallback Create Folder Box */}
              {errorState && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-3">
                  <div className="flex items-start gap-2 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium leading-relaxed">{errorState.message}</p>
                  </div>

                  {errorState.serviceAccountEmail && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-amber-200 px-3 py-2 text-[11px]">
                      <span className="font-mono text-slate-700 truncate">{errorState.serviceAccountEmail}</span>
                      <button
                        type="button"
                        onClick={() => void handleCopySaEmail(errorState.serviceAccountEmail!)}
                        className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 shrink-0"
                      >
                        {copiedSaEmail ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSaEmail ? 'Zkopírováno' : 'Kopírovat e-mail'}</span>
                      </button>
                    </div>
                  )}

                  {errorState.canCreateNewFolder && (
                    <div className="pt-2 border-t border-amber-200/80 space-y-2">
                      <label className="block text-[11px] font-bold text-amber-950">
                        Název nové složky v „SeePoint Realizace (FTD)“ na vašem Google Disku:
                      </label>
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        disabled={isBusy}
                        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        disabled={isBusy || !newFolderName.trim()}
                        onClick={() => void runExport('CREATE_NEW')}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-black shadow-sm transition disabled:opacity-50"
                      >
                        {submittingMode === 'CREATE_NEW' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Vytvářím složku a nahrávám fotky…</span>
                          </>
                        ) : (
                          <>
                            <FolderPlus className="w-4 h-4" />
                            <span>Vytvořit novou složku na Disku a nahrát fotky ({photosCount})</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Primary Action Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void runExport('CREATE_NEW')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 transition disabled:opacity-50"
                  title="Vytvořit novou složku na připojeném Google Disku a nahrát do ní fotky"
                >
                  {submittingMode === 'CREATE_NEW' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FolderPlus className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>Vytvořit novou složku</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={onClose}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Zavřít
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || !targetFolderUrl.trim()}
                    onClick={() => void runExport('EXISTING_OR_SEARCH')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-black shadow-sm transition disabled:opacity-50"
                  >
                    {submittingMode === 'EXISTING_OR_SEARCH' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Nahrávám na Disk…</span>
                      </>
                    ) : (
                      <>
                        <FolderUp className="w-4 h-4" />
                        <span>Odeslat do složky ({photosCount})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
