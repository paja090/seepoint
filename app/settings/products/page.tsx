import { AppShell } from '@/components/AppShell';
import { ProductCatalogSettings } from '@/components/settings/ProductCatalogSettings';
import { requirePageAccess } from '@/lib/page-auth';
import Link from 'next/link';

export default async function ProductsSettingsPage() {
  await requirePageAccess('settings');

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/settings" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">
          ← Zpět do Nastavení
        </Link>
      </div>
      <ProductCatalogSettings />
    </AppShell>
  );
}
