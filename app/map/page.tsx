import { AppShell } from '@/components/AppShell';
import { CarrierFilters } from '@/components/CarrierFilters';
import { MapView } from '@/components/MapView';
import { parseCarrierFilters } from '@/lib/carrier-filters';
import { getCarrierFilterOptions, getCarriers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseCarrierFilters(params);
  const selectedCarrierId = Array.isArray(params.carrier) ? params.carrier[0] : params.carrier;
  const [carriers, filterOptions] = await Promise.all([
    getCarriers(filters),
    getCarrierFilterOptions(),
  ]);
  const selectedIndex = selectedCarrierId ? carriers.findIndex((carrier) => carrier.id === selectedCarrierId) : -1;
  const orderedCarriers = selectedIndex > 0
    ? [carriers[selectedIndex], ...carriers.slice(0, selectedIndex), ...carriers.slice(selectedIndex + 1)]
    : carriers;

  return (
    <AppShell>
      <CarrierFilters action="/map" filters={filters} options={filterOptions} resultCount={carriers.length} />
      <MapView initialCarriers={orderedCarriers} />
    </AppShell>
  );
}
