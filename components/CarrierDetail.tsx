import type { Carrier } from '@/lib/types';
import { PhotoGallery } from './PhotoGallery';
import { StatusBadge } from './StatusBadge';

export function CarrierDetail({ carrier }: { carrier: Carrier }) {
  const campaigns = carrier.surfaces.flatMap((surface) =>
    surface.occupancies.map((occupancy) => ({ ...occupancy, surface: surface.name })),
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{carrier.name}</h2>
        <p className="text-sm text-slate-500">{carrier.code} · {carrier.type}</p>
      </div>
      <div className="grid gap-2 text-sm">
        <p><b>GPS:</b> {carrier.latitude}, {carrier.longitude}</p>
        <p><b>Adresa:</b> {carrier.address}, {carrier.city}</p>
        <p><b>Stav:</b> <StatusBadge value={carrier.status} /></p>
        <p><b>Poznámka:</b> {carrier.note}</p>
      </div>
      <PhotoGallery carrierId={carrier.id} carrierPhotos={carrier.photos} surfaces={carrier.surfaces} />
      <section>
        <h3 className="font-semibold mb-2">Reklamní plochy</h3>
        <div className="space-y-2">
          {carrier.surfaces.map((surface) => (
            <div key={surface.id} className="rounded-xl border p-3">
              <div className="flex justify-between">
                <b>{surface.name}</b>
                <StatusBadge value={surface.status} />
              </div>
              <p className="text-sm text-slate-500">
                {surface.size} · {surface.orientation} · {surface.price?.toLocaleString('cs-CZ')} Kč
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="font-semibold mb-2">Historie kampaní</h3>
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="text-sm border-b py-2">
            <b>{campaign.campaignName}</b> ({campaign.clientName})<br />
            {campaign.surface}: {campaign.dateFrom} – {campaign.dateTo}
          </div>
        ))}
      </section>
    </div>
  );
}
