'use client';

import type { Carrier, Client, SurfaceStatus } from '@/lib/types';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { CarrierArchiveActions } from './CarrierArchiveActions';
import { ClientAssignments } from './ClientAssignments';
import { LocationMiniMap } from './LocationMiniMap';
import { PhotoGallery } from './PhotoGallery';
import { StatusBadge } from './StatusBadge';

type SurfaceClientChangeHandler = (
  surfaceId: string,
  currentClient: Pick<Client, 'id' | 'name'> | undefined,
  status: SurfaceStatus,
) => void;

export function CarrierDetail({
  carrier,
  onSurfaceClientChanged,
  showLocationMap = false,
}: {
  carrier: Carrier;
  onSurfaceClientChanged?: SurfaceClientChangeHandler;
  showLocationMap?: boolean;
}) {
  const campaigns = carrier.surfaces.flatMap((surface) =>
    surface.occupancies.map((occupancy) => ({ ...occupancy, surface: surface.name })),
  );
  const coordinates =
    typeof carrier.latitude === 'number' &&
    Number.isFinite(carrier.latitude) &&
    typeof carrier.longitude === 'number' &&
    Number.isFinite(carrier.longitude)
      ? { latitude: carrier.latitude, longitude: carrier.longitude }
      : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{carrier.name}</h2>
        <p className="text-sm text-slate-500">
          {carrier.code} · {carrier.type}
        </p>
      </div>

      {carrier.archivedAt && (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Tento nosič je archivovaný.</p>
          <p className="mt-1 text-slate-600">
            Archivace: {new Date(carrier.archivedAt).toLocaleDateString('cs-CZ')}
            {carrier.archiveReason ? ` · Důvod: ${carrier.archiveReason}` : ''}
          </p>
        </section>
      )}

      <div className="grid gap-2 text-sm">
        <p>
          <b>GPS:</b>{' '}
          {coordinates
            ? `${coordinates.latitude}, ${coordinates.longitude}`
            : 'Chybí – čeká na ruční umístění'}
        </p>
        <p>
          <b>Adresa:</b>{' '}
          {[carrier.street ?? carrier.address, carrier.locality ?? carrier.cadastralArea, carrier.city]
            .filter(Boolean)
            .join(', ') || 'Neuvedena'}
        </p>
        {carrier.structureCode && (
          <p>
            <b>Sloup / stožár:</b> {carrier.structureCode} · {carrier.mountingType}
          </p>
        )}
        <p>
          <b>Stav:</b> <StatusBadge value={carrier.archivedAt ? 'ARCHIVED' : carrier.status} />
        </p>
        {carrier.description && (
          <p>
            <b>Popis:</b> {carrier.description}
          </p>
        )}
        {carrier.placementDescription && (
          <p>
            <b>Umístění:</b> {carrier.placementDescription}
          </p>
        )}
        {carrier.note && (
          <p>
            <b>Poznámka:</b> {carrier.note}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href="#carrier-form">
          Upravit
        </a>
        <a className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="#photo-gallery">
          Přidat fotku
        </a>
        <a className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="#surfaces">
          Přidat / upravit plochu
        </a>
        <a className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="#campaign-history">
          Obsazenost
        </a>
        <CarrierArchiveActions carrier={carrier} />
      </div>

      {showLocationMap && coordinates && (
        <LocationMiniMap
          carrierId={carrier.id}
          carrierName={carrier.name}
          latitude={coordinates.latitude}
          longitude={coordinates.longitude}
        />
      )}
      {showLocationMap && !coordinates && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="missing-location-heading">
          <h3 id="missing-location-heading" className="font-semibold text-amber-900">
            Umístění nosiče zatím chybí
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            Doplňte GPS ve formuláři, nebo otevřete mapu a ručně umístěte bod.
          </p>
          <a className="mt-3 inline-block text-sm font-medium text-amber-900 underline" href={`/map?carrier=${encodeURIComponent(carrier.id)}&gps=missing`}>
            Otevřít v mapě
          </a>
        </section>
      )}

      <div id="photo-gallery" className="scroll-mt-6">
        <PhotoGallery carrierId={carrier.id} carrierPhotos={carrier.photos} surfaces={carrier.surfaces} />
      </div>

      <section id="surfaces" className="scroll-mt-6">
        <h3 className="mb-2 font-semibold">Reklamní plochy, navigace a klienti</h3>
        {carrier.surfaces.length > 0 && (
          <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
            {carrier.surfaces.map((surface) => (
              <div className="rounded-xl bg-slate-50 p-3" key={surface.id}>
                <p className="font-medium">{surface.name}</p>
                <p className="text-slate-500">
                  {mediaTypeLabel(surface.mediaType)} · {surface.currentClient?.name ?? 'bez klienta'}
                </p>
              </div>
            ))}
          </div>
        )}
        <ClientAssignments initialSurfaces={carrier.surfaces} onChanged={onSurfaceClientChanged} />
      </section>

      <section id="campaign-history" className="scroll-mt-6">
        <h3 className="mb-2 font-semibold">Historie kampaní</h3>
        {campaigns.length > 0 ? (
          campaigns.map((campaign) => (
            <div key={campaign.id} className="border-b py-2 text-sm">
              <b>{campaign.campaignName}</b> ({campaign.clientName})
              <br />
              {campaign.surface}: {campaign.dateFrom} – {campaign.dateTo}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Historie kampaní zatím není doplněna.</p>
        )}
      </section>
    </div>
  );
}
