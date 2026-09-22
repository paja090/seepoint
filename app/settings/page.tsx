import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { hasModuleAccess } from '@/lib/module-policy';
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
      {hasModuleAccess(user, 'planner', 'planner') && <div className="card mb-6"><a href="/settings/planner" className="font-bold text-sky-700">Calendar & Planner →</a><p className="text-sm text-slate-600">Osobní kalendáře, pracovní doba a soustředěná práce.</p></div>}
      <div className="card space-y-3">
        <p>Google Maps API: <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code></p>
        <p>Databáze: <code>DATABASE_URL</code> pro PostgreSQL.</p>
        <p>Fotky: lokálně v <code>public/uploads</code>, připraveno pro výměnu za S3/GCS storage adapter.</p>
      </div>

      <div className="card mt-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">🏷️ Typy reklamních nosičů</h2>
          <p className="text-sm text-slate-600 mt-1">Vlastní typy nosičů organizace (např. Billboard, Bigboard, CLV, LED panel, Lavička) s vlastními barvami a ikonami.</p>
        </div>
        <a href="/settings/carrier-types" className="button button-primary text-sm font-bold">
          Spravovat typy nosičů →
        </a>
      </div>

      <div className="card mt-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">📦 Katalog produktů & nabídek</h2>
          <p className="text-sm text-slate-600 mt-1">Vlastní obchodní produkty vaší společnosti navázané na typy nosičů pro nabídky a kalkulace.</p>
        </div>
        <a href="/settings/products" className="button button-primary text-sm font-bold">
          Spravovat produkty →
        </a>
      </div>

      <div className="card mt-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">🏭 Činnosti výroby & montáží</h2>
          <p className="text-sm text-slate-600 mt-1">Vlastní katalog činností pro dílnu i výjezdy (tisk, DTP, polepy, montáže, zaměření) a oborové šablony.</p>
        </div>
        <a href="/settings/work" className="button button-primary text-sm font-bold">
          Spravovat činnosti →
        </a>
      </div>

      <div className="card mt-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">✉️ Firemní e-mail & Domény</h2>
          <p className="text-sm text-slate-600 mt-1">Nastavení odesílací domény pro nabídky a notifikace s ověřením SPF a DKIM.</p>
        </div>
        <a href="/settings/email" className="button button-primary text-sm font-bold">
          Spravovat e-maily →
        </a>
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
