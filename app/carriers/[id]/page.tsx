import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CarrierDetail } from '@/components/CarrierDetail';
import { CarrierForm } from '@/components/CarrierForm';
import { getCarrier } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function CarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const carrier = await getCarrier((await params).id);
  if (!carrier) notFound();
  return <AppShell><div className="grid lg:grid-cols-[1fr_420px] gap-6"><div className="card"><CarrierDetail carrier={carrier}/></div><div className="card"><h2 className="font-bold mb-4">Upravit nosič</h2><CarrierForm carrier={carrier}/></div></div></AppShell>;
}
