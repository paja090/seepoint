'use client';

import type { Carrier, Client, SurfaceStatus } from '@/lib/types';
import { ClientAssignments } from './ClientAssignments';
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
}: {
  carrier: Carrier;
  onSurfaceClientChanged?: SurfaceClientChangeHandler;
}) {
  const campaigns = carrier.surfaces.flatMap((surface) =>
    surface.occupancies.map((occupancy) => ({ ...occupancy, surface: surface.name })),
  );
  const hasGps = Number.isFinite(carrier.latitude) && Number.isFinite(carrier.longitude);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{carrier.name}</h2>
        <p className="text-sm text-slate-500">{carrier.code} · {carrier.type}</p>
      </div>
      <div className="grid gap-2 text-sm">
        <p><b>GPS:</b> {hasGps ? `${carrier.latitude}, ${carrier.longitude}` : 'Chybí – čeká na ruční umístění'}</p>
        <p><b>Adresa:</b> {[carrier.address, carrier.city, carrier.cadastralArea].filter(Boolean).join(', ') || 'Neuvedena'}</p>
        {carrier.structureCode && <p><b>Sloup / stožár:</b> {carrier.structureCode} · {carrier.mountingType}</p>}
        <p><b>Stav:</b> <StatusBadge value={carrier.status} /></p>
        {carrier.note && <p><b>Poznámka:</b> {carrier.note}</p>}
      </div>
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
