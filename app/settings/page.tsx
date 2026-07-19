import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { CompanyRatesSettings } from '@/components/CompanyRatesSettings';
import { OfferPriceCatalogSettings } from '@/components/offers/OfferPriceCatalogSettings';
import { MediaPackageSettings } from '@/components/offers/MediaPackageSettings';
import { PriceListSettings } from '@/components/PriceListSettings';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';

const money = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });

export default async function Settings() {
  const user = await requirePageAccess('settings');
  const isAdmin = user.role === 'ADMIN';

  let prices: Awaited<ReturnType<typeof prisma.priceListItem.findMany>> = [];
  let priceError: string | undefined;
  try {
    prices = await prisma.priceListItem.findMany({ where: { isActive: true, validTo: null }, orderBy: [{ name: 'asc' }, { validFrom: 'desc' }] });
  } catch (error) {
    priceError = isMissingDatabaseStructureError(error) ? productionMigrationMessage() : 'Ceník se nepodařilo načíst.';
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-bold mb-6">Nastavení</h1>
      <div className="card space-y-3">
        <p>Google Maps API: <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code></p>
        <p>Databáze: <code>DATABASE_URL</code> pro PostgreSQL.</p>
        <p>Fotky: lokálně v <code>public/uploads</code>, připraveno pro výměnu za S3/GCS storage adapter.</p>
      </div>      {priceError ? (
        <section className="card mt-6">
          <h2 className="mb-4 text-xl font-semibold">Ceník nosičů</h2>
          <p className="text-amber-700">{priceError}</p>
        </section>
      ) : (
        <PriceListSettings
          initialPrices={prices.map((price) => ({
            id: price.id,
            name: price.name,
            carrierType: price.carrierType,
            mediaType: price.mediaType,
            rentalMonths: price.rentalMonths,
            minQuantity: price.minQuantity,
            rentalPrice: price.rentalPrice.toString(),
            productionPrice: price.productionPrice.toString(),
            totalPrice: price.totalPrice.toString(),
            validFrom: price.validFrom.toISOString(),
          }))}
        />
      )}
      {isAdmin && <OfferPriceCatalogSettings />}
      {isAdmin && <MediaPackageSettings />}
      {isAdmin && <CompanyRatesSettings />}
    </AppShell>
  );
}
