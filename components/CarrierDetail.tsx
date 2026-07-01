import type { Carrier } from '@/lib/types';
import { PhotoGallery } from './PhotoGallery';
import { StatusBadge } from './StatusBadge';

export function CarrierDetail({ carrier }: { carrier: Carrier }) {
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
        <h3 className="mb-2 font-semibold">Reklamní plochy a navigace</h3>
        <div className="space-y-2">
          {carrier.surfaces.map((surface) => {
            const legacyDescription = [surface.size, surface.orientation, surface.price ? `${surface.price.toLocaleString('cs-CZ')} Kč` : undefined]
              .filter(Boolean)
              .join(' · ');
            return (
              <div key={surface.id} className="rounded-xl border p-3">
                <div className="flex justify-between gap-3">
                  <div>
                    <b>{surface.name}</b>
                    <p className="text-xs text-slate-500">
                      {[surface.mediaType, surface.sourcePosition, surface.currentClient?.name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <StatusBadge value={surface.status} />
                </div>
                {surface.directionDescription && <p className="mt-2 text-sm">{surface.directionDescription}</p>}
                {legacyDescription && <p className="text-sm text-slate-500">{legacyDescription}</p>}
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Historie kampaní</h3>
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="border-b py-2 text-sm">
            <b>{campaign.campaignName}</b> ({campaign.clientName})<br />
            {campaign.surface}: {campaign.dateFrom} – {campaign.dateTo}
          </div>
        ))}
      </section>
    </div>
  );
}
