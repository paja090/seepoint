import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { CrmClientDetail } from '@/components/sales/CrmClientDetail';
import { getCrmClient } from '@/lib/mock-sales-data';

export const metadata = { title: 'Karta klienta | SeePOINT' };

export default async function CrmClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = getCrmClient(id);
  if (!client) notFound();

  return (
    <AppShell>
      <Link
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        href="/sales/crm"
      >
        <ArrowLeft aria-hidden size={16} />
        Zpět na CRM
      </Link>
      <CrmClientDetail client={client} />
    </AppShell>
  );
}
