'use client';

import type { Carrier, Client, SurfaceStatus } from '@/lib/types';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { CarrierArchiveActions } from './CarrierArchiveActions';
import { ClientAssignments } from './ClientAssignments';
import { LocationMiniMap } from './LocationMiniMap';
import { OccupancyActions } from './OccupancyActions';
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
  clients = [],
  canEdit = false,
  userRole,
}: {
  carrier: Carrier;
  onSurfaceClientChanged?: SurfaceClientChangeHandler;
  showLocationMap?: boolean;
  clients?: Array<Pick<Client, 'id' | 'name'>>;
  canEdit?: boolean;
  userRole?: string;
}) {
  const campaigns = carrier.surfaces.flatMap((surface) =>
    surface.occupancies.map((occupancy) => ({ ...occupancy, surface: surface.name })),
  );
  const activeCampaigns = campaigns.filter((campaign) =>
    campaign.status === 'OCCUPIED' || campaign.status === 'RESERVED' || campaign.status === 'NEGOTIATION');
  const primaryCampaign = activeCampaigns
    .slice()
    .sort((left, right) => left.dateTo.localeCompare(right.dateTo))[0];
  const daysToEnd = primaryCampaign
    ? Math.ceil((new Date(`${primaryCampaign.dateTo}T00:00:00.000Z`).getTime() - Date.now()) / 86_400_000)
    : undefined;
  const coordinates =
    typeof carrier.latitude === 'number' &&
    Number.isFinite(carrier.latitude) &&
    typeof carrier.longitude === 'number' &&
    Number.isFinite(carrier.longitude)
      ? { latitude: carrier.latitude, longitude: carrier.longitude }
      : null;

  return (
    <div className="space-y-5">
      {userRole && (
        <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-xs rounded-xl" id="debug-user-role">
          Role: {userRole} | canEdit: {String(canEdit)}
        </div>
      )}
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
        <p><b>GPS:</b> {coordinates ? `${coordinates.latitude}, ${coordinates.longitude}` : 'Chybí'}</p>
        <p>
          <b>Adresa:</b>{' '}
          {[carrier.street ?? carrier.address, carrier.locality ?? carrier.cadastralArea, carrier.city]
            .filter(Boolean)
            .join(', ') || 'Neuvedena'}
        </p>
        {carrier.structureCode && <p><b>Sloup / stožár:</b> {carrier.structureCode} · {carrier.mountingType}</p>}
        <p><b>Stav:</b> <StatusBadge value={carrier.archivedAt ? 'ARCHIVED' : carrier.status} /></p>
        {carrier.description && <p><b>Popis:</b> {carrier.description}</p>}
        {carrier.placementDescription && <p><b>Umístění:</b> {carrier.placementDescription}</p>}
        {carrier.note && <p><b>Poznámka:</b> {carrier.note}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href="#carrier-form">Upravit</a>
        <a className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="#photo-gallery">Přidat fotku</a>
        <a className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="#surfaces">Přidat / upravit plochu</a>
        <a className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="#campaign-history">Obsazenost</a>
        <CarrierArchiveActions carrier={carrier} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Aktuální obsazenost</h3>
            <p className="text-sm text-slate-500">Rychlý pohled pro obchodníka přímo na detailu nosiče.</p>
          </div>
          {primaryCampaign ? <StatusBadge value={primaryCampaign.status} /> : <StatusBadge value="AVAILABLE" />}
        </div>
        {primaryCampaign ? (
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p><b>Klient:</b> {primaryCampaign.clientName}</p>
            <p><b>Kampaň:</b> {primaryCampaign.campaignName}</p>
            <p><b>Plocha:</b> {primaryCampaign.surface}</p>
            <p><b>Termín:</b> {primaryCampaign.dateFrom} - {primaryCampaign.dateTo}</p>
            <p><b>Do konce:</b> {daysToEnd !== undefined ? `${daysToEnd} dnů` : 'neuvedeno'}</p>
            {primaryCampaign.price && <p><b>Cena:</b> {primaryCampaign.price.toLocaleString('cs-CZ')} Kč</p>}
            {primaryCampaign.note && <p className="md:col-span-2"><b>Poznámka:</b> {primaryCampaign.note}</p>}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Na tomto nosiči není podle aktuálních dat aktivní kampaň ani rezervace.</p>
        )}
        <OccupancyActions
          activeOccupancy={primaryCampaign}
          clients={clients}
          surfaces={carrier.surfaces.map((surface) => ({ id: surface.id, name: surface.name, price: surface.price }))}
        />
      </section>

      {showLocationMap && coordinates && (
        <LocationMiniMap
          carrierId={carrier.id}
          carrierName={carrier.name}
          latitude={coordinates.latitude}
          longitude={coordinates.longitude}
        />
      )}

      <div id="photo-gallery" className="scroll-mt-6">
        <PhotoGallery carrierId={carrier.id} carrierPhotos={carrier.photos} surfaces={carrier.surfaces} canEdit={canEdit} />
      </div>

      <section id="surfaces" className="scroll-mt-6">
        <h3 className="mb-2 font-semibold">Reklamní plochy, navigace a klienti</h3>
        {carrier.surfaces.length > 0 && (
          <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
            {carrier.surfaces.map((surface) => (
              <div className="rounded-xl bg-slate-50 p-3" key={surface.id}>
                <p className="font-medium">{surface.name}</p>
                <p className="text-slate-500">{mediaTypeLabel(surface.mediaType)} · {surface.currentClient?.name ?? 'bez klienta'}</p>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{campaign.campaignName}</b>
                <StatusBadge value={campaign.status} />
              </div>
              <span className="text-slate-600">{campaign.clientName}</span>
              <br />
              {campaign.surface}: {campaign.dateFrom} - {campaign.dateTo}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Historie kampaní zatím není doplněna.</p>
        )}
      </section>
    </div>
  );
}
