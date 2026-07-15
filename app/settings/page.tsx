import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { CompanyRatesSettings } from '@/components/CompanyRatesSettings';
import { OfferPriceCatalogSettings } from '@/components/offers/OfferPriceCatalogSettings';

export default async function Settings() {
  const user = await requirePageAccess('settings');
  const isAdmin = user.role === 'ADMIN';

  return (
    <AppShell>
      <h1 className="text-3xl font-bold mb-6">Nastavení</h1>
      <div className="card space-y-3">
        <p>Google Maps API: <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code></p>
        <p>Databáze: <code>DATABASE_URL</code> pro PostgreSQL.</p>
        <p>Fotky: lokálně v <code>public/uploads</code>, připraveno pro výměnu za S3/GCS storage adapter.</p>
      </div>

      {isAdmin && <OfferPriceCatalogSettings />}
      {isAdmin && <CompanyRatesSettings />}
    </AppShell>
  );
}
