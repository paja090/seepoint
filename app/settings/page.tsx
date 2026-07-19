import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { CompanyRatesSettings } from '@/components/CompanyRatesSettings';
import { OfferPriceCatalogSettings } from '@/components/offers/OfferPriceCatalogSettings';
import { MediaPackageSettings } from '@/components/offers/MediaPackageSettings';
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
      </div>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="mb-4 text-xl font-semibold">Ceník</h2>
        {priceError ? (
          <p className="text-amber-700">{priceError}</p>
        ) : prices.length === 0 ? (
          <p>Zatím nejsou uložené žádné aktivní ceny.</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Reklamní nosič</th>
                <th className="p-2">Měsíce</th>
                <th className="p-2">Min. ks</th>
                <th className="p-2">Pronájem / ks</th>
                <th className="p-2">Tisk a instalace</th>
                <th className="p-2">Celkem</th>
                <th className="p-2">Platnost od</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((price) => (
                <tr className="border-b" key={price.id}>
                  <td className="p-2 font-medium">{price.name}</td>
                  <td className="p-2">{price.rentalMonths}</td>
                  <td className="p-2">{price.minQuantity}</td>
                  <td className="p-2">{money.format(price.rentalPrice.toNumber())}</td>
                  <td className="p-2">{money.format(price.productionPrice.toNumber())}</td>
                  <td className="p-2">{money.format(price.totalPrice.toNumber())}</td>
                  <td className="p-2">{price.validFrom.toLocaleDateString('cs-CZ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isAdmin && <OfferPriceCatalogSettings />}
      {isAdmin && <MediaPackageSettings />}
      {isAdmin && <CompanyRatesSettings />}
    </AppShell>
  );
}
