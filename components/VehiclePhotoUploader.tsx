'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, Check, Loader2 } from 'lucide-react';

interface VehiclePhotoUploaderProps {
  vehicleId: string;
  currentPhotoUrl?: string | null;
  vehicleName: string;
}

export function VehiclePhotoUploader({ vehicleId, currentPhotoUrl, vehicleName }: VehiclePhotoUploaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl || null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/vehicles/${vehicleId}/photo`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Nahrání selhalo');
      }

      setPhotoUrl(data.photoUrl);
      setSuccess(true);
      startTransition(() => {
        router.refresh();
      });
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nahrání se nepodařilo');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Current Photo Preview */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-2 text-center">
        {photoUrl ? (
          <div className="relative group aspect-video w-full max-w-sm mx-auto overflow-hidden rounded-xl bg-slate-900 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={`Fotografie ${vehicleName}`}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <label className="cursor-pointer rounded-xl bg-white/90 px-3.5 py-2 text-xs font-black text-slate-900 shadow-md hover:bg-white transition flex items-center gap-1.5">
                <Camera size={14} className="text-sky-600" />
                <span>Změnit fotku</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading || isPending}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="py-6 px-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 mb-2">
              <Camera size={24} />
            </div>
            <p className="text-xs font-extrabold text-slate-800">Zatím nebola nahraná fotka vozidla</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Nahrajte foto z auta, techničáku nebo z výjezdu</p>
          </div>
        )}

        {/* Upload Button */}
        <div className="mt-3 flex justify-center">
          <label className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white cursor-pointer shadow-md transition ${
            uploading || isPending
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-sky-600 hover:bg-sky-700'
          }`}>
            {uploading || isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Nahrávám fotografii...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>{photoUrl ? '📷 Nahrát novou fotku' : '📷 Vybrat a nahrát fotku'}</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading || isPending}
              className="hidden"
            />
          </label>
        </div>

        {/* Success Confirmation */}
        {success && (
          <div className="mt-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-xl p-2 flex items-center justify-center gap-1.5">
            <Check size={14} className="text-emerald-600" />
            <span>Fotografie vozidla byla úspěšně uložena!</span>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mt-2 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-300 rounded-xl p-2">
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
}
