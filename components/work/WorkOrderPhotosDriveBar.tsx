'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, FolderUp, ExternalLink, Smartphone, CheckCircle2 } from 'lucide-react';
import { ExportToDriveModal } from '@/components/fotodokumentace/ExportToDriveModal';

export interface WorkOrderPhotoPreview {
  id: string;
  fileName: string | null;
  type: string;
  createdAt: string;
  capturedByWorkerName: string | null;
}

export interface WorkOrderPhotosDriveBarProps {
  workOrderId: string;
  title: string;
  clientName?: string | null;
  ftdUrl?: string | null;
  photos: WorkOrderPhotoPreview[];
  exportedCount: number;
  lastExportedFolderUrl?: string | null;
  isEligibleForPhotoApp: boolean;
}

export function WorkOrderPhotosDriveBar({
  workOrderId,
  title,
  clientName,
  ftdUrl,
  photos,
  exportedCount,
  lastExportedFolderUrl,
  isEligibleForPhotoApp,
}: WorkOrderPhotosDriveBarProps) {
  const router = useRouter();
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedNow, setExportedNow] = useState<{ count: number; folderUrl: string } | null>(null);

  const albumHref = `/fotodokumentace?albumId=${encodeURIComponent(`wo::${workOrderId}`)}`;
  const effectiveExportedCount = exportedNow ? Math.max(exportedCount, exportedNow.count) : exportedCount;
  const effectiveFolderUrl = exportedNow?.folderUrl || lastExportedFolderUrl || null;

  return (
    <section className="card space-y-4 border-indigo-200 bg-indigo-50/25">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-800">
            <Camera size={16} className="text-indigo-600" />
            <span>Fotodokumentace realizace (SeePoint OS)</span>
            {isEligibleForPhotoApp && (
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold normal-case">
                Aktivní v mobilní aplikaci
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 font-medium mt-1">
            {photos.length > 0
              ? `Uloženo ${photos.length} ${photos.length === 1 ? 'fotografie' : photos.length >= 2 && photos.length <= 4 ? 'fotografie' : 'fotografií'} z realizace.`
              : 'Složka pro fotky je připravena — pracovníci zakázku vidí přímo v mobilní aplikaci.'}
            {effectiveExportedCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Na Google Disku: {effectiveExportedCount}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {photos.length > 0 && (
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-black shadow-sm transition"
            >
              <FolderUp size={15} />
              <span>Odeslat do složky na Google Disku</span>
            </button>
          )}
          <Link
            href={albumHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-800 px-3 py-2 text-xs font-bold transition"
          >
            <span>Otevřít fotoalbum</span>
            <ExternalLink size={13} />
          </Link>
          <Link
            href="/mobile-photos"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-bold transition"
          >
            <Smartphone size={13} />
            <span>Mobilní focení</span>
          </Link>
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {photos.slice(0, 6).map((photo) => (
              <a
                key={photo.id}
                href={`/api/photos/${encodeURIComponent(photo.id)}/file`}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 block"
                title={photo.fileName || 'Fotografie realizace'}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${encodeURIComponent(photo.id)}/thumbnail`}
                  alt={photo.fileName || 'Fotografie realizace'}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                />
              </a>
            ))}
          </div>
          {photos.length > 6 && (
            <Link
              href={albumHref}
              className="inline-block text-xs font-bold text-indigo-700 hover:underline"
            >
              Zobrazit všech {photos.length} fotografií ve Fotodokumentaci →
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-indigo-200 bg-white/80 p-4 text-xs text-slate-600">
          Zatím nebyla vyfocena žádná fotka. Technik ji může vyfotit přes{' '}
          <Link href="/mobile-photos" className="font-bold text-indigo-700 hover:underline">
            Mobilní fotodokumentaci
          </Link>
          , nebo ji můžete nahrát přímo ve{' '}
          <Link href={albumHref} className="font-bold text-indigo-700 hover:underline">
            Fotodokumentaci
          </Link>
          .
        </div>
      )}

      {effectiveFolderUrl && (
        <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Poslední export na Google Disk:</span>
          <a
            href={effectiveFolderUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
          >
            <span>Otevřít exportovanou složku</span>
            <ExternalLink size={12} />
          </a>
        </div>
      )}

      <ExportToDriveModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title={title}
        clientName={clientName}
        photosCount={photos.length}
        photoIds={photos.map((p) => p.id)}
        workOrderId={workOrderId}
        albumId={`wo::${workOrderId}`}
        source="WORK_ORDER"
        defaultTargetUrl={ftdUrl}
        lastExportedFolderUrl={effectiveFolderUrl}
        onExported={(res) => {
          setExportedNow({
            count: res.uploadedCount + res.skippedCount,
            folderUrl: res.folderUrl,
          });
          router.refresh();
        }}
      />
    </section>
  );
}
