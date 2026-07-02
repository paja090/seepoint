import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CarrierDetail } from '@/components/CarrierDetail';
import { CarrierForm } from '@/components/CarrierForm';
import { getCarrier } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function CarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const carrier = await getCarrier((await params).id);
  if (!carrier) notFound();

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="card">
          <CarrierDetail carrier={carrier} showLocationMap />
        </div>
        <div id="carrier-form" className="card scroll-mt-6">
          <h2 className="mb-4 font-bold">Upravit nosič</h2>
          <CarrierForm carrier={carrier} />
        </div>
      </div>
    </AppShell>
  );
}
