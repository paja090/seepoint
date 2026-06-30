import { AppShell } from '@/components/AppShell';
import { MapView } from '@/components/MapView';
import { getCarriers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  return <AppShell><MapView initialCarriers={await getCarriers()}/></AppShell>;
}
