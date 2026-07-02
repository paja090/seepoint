'use client';

import type { Carrier, Client, SurfaceStatus } from '@/lib/types';
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
  const coordinates = typeof carrier.latitude === 'number'
    && Number.isFinite(carrier.latitude)
    && typeof carrier.longitude === 'number'
    && Number.isFinite(carrier.longitude)
    ? { latitude: carrier.latitude, longitude: carrier.longitude }
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{carrier.name}</h2>
        <p className="text-sm text-slate-500">{carrier.code} · {carrier.type}</p>
      </div>
      <div className="grid gap-2 text-sm">
        <p><b>GPS:</b> {coordinates ? `${coordinates.latitude}, ${coordinates.longitude}` : 'Chybí – čeká na ruční umístění'}</p>
        <p><b>Adresa:</b> {[carrier.address, carrier.city, carrier.cadastralArea].filter(Boolean).join(', ') || 'Neuvedena'}</p>
        {carrier.structureCode && <p><b>Sloup / stožár:</b> {carrier.structureCode} · {carrier.mountingType}</p>}
        <p><b>Stav:</b> <StatusBadge value={carrier.status} /></p>
        {carrier.note && <p><b>Poznámka:</b> {carrier.note}</p>}
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
          <h3 id="missing-location-heading" className="font-semibold text-amber-900">Umístění nosiče zatím chybí</h3>
          <p className="mt-1 text-sm text-amber-800">Doplňte zeměpisnou šířku a délku ve formuláři pro úpravu nosiče.</p>
          <a className="mt-3 inline-block text-sm font-medium text-amber-900 underline" href="#carrier-form">Přejít k GPS údajům</a>
        </section>
      )}
      <PhotoGallery carrierId={carrier.id} carrierPhotos={carrier.photos} surfaces={carrier.surfaces} />
      <section>
        <h3 className="mb-2 font-semibold">Reklamní plochy, navigace a klienti</h3>
        <ClientAssignments initialSurfaces={carrier.surfaces} onChanged={onSurfaceClientChanged} />
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Historie kampaní</h3>
        {campaigns.length > 0 ? campaigns.map((campaign) => (
          <div key={campaign.id} className="border-b py-2 text-sm">
            <b>{campaign.campaignName}</b> ({campaign.clientName})<br />
            {campaign.surface}: {campaign.dateFrom} – {campaign.dateTo}
          </div>
        )) : <p className="text-sm text-slate-500">Historie kampaní zatím není doplněna.</p>}
      </section>
    </div>
  );
}
