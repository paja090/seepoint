import { AppShell } from '@/components/AppShell';
import { MapView } from '@/components/MapView';
import { getCarriers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ carrier?: string }>;
}) {
  const carriers = await getCarriers();
  const selectedCarrierId = (await searchParams).carrier;
  const selectedIndex = selectedCarrierId ? carriers.findIndex((carrier) => carrier.id === selectedCarrierId) : -1;
  const orderedCarriers = selectedIndex > 0
    ? [carriers[selectedIndex], ...carriers.slice(0, selectedIndex), ...carriers.slice(selectedIndex + 1)]
    : carriers;

  return <AppShell><MapView initialCarriers={orderedCarriers} /></AppShell>;
}
