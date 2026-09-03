import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Galerie venku vyžaduje modulové oprávnění a validuje stav i počet rámů', () => {
  const route = source('app/api/city-gallery/projects/route.ts');
  const policy = source('lib/city-gallery-policy.ts');
  assert.match(route, /requireApiAccess\('cityGallery'\)/);
  assert.match(route, /parseCityGalleryProjectInput/);
  assert.match(policy, /Object\.values\(CityGalleryProjectStatus\)\.includes/);
  assert.match(policy, /Number\.isInteger\(frameCount\)/);
});

test('ceníkové API odmítá neplatné enumy, záporné ceny a chybné období', () => {
  const createRoute = source('app/api/price-list-items/route.ts');
  const updateRoute = source('app/api/price-list-items/[id]/route.ts');
  for (const route of [createRoute, updateRoute]) {
    assert.match(route, /Object\.values\(CarrierType\)\.includes/);
    assert.match(route, /Object\.values\(MediaType\)\.includes/);
    assert.match(route, /Number\.isFinite\(rentalPrice\)/);
    assert.match(route, /rentalPrice < 0/);
  }
  assert.match(updateRoute, /validTo < validFromDate/);
  assert.match(updateRoute, /typeof body\.isActive !== 'boolean'/);
});

test('obchodní radar nepředává neznámý stav do Prisma vrstvy', () => {
  const route = source('app/api/sales/opportunities/[id]/route.ts');
  const policy = source('lib/opportunities/policy.ts');
  assert.match(route, /parseOpportunityStatusInput/);
  assert.match(policy, /Object\.values\(OpportunityStatus\)\.includes/);
  assert.match(policy, /assertOpportunityTransition/);
});

test('formulář navigační smlouvy nepoužívá náhodnou hodnotu během SSR', () => {
  const component = source('components/navigation/ContractManagementView.tsx');
  const page = source('app/navigation/contracts/page.tsx');
  assert.doesNotMatch(component, /Math\.random/);
  assert.match(component, /currentDate: string/);
  assert.match(page, /currentDate=\{new Date\(\)\.toISOString\(\)\}/);
});

test('Drive OAuth údaje samy o sobě nepovolují odesílání přes Gmail', () => {
  const email = source('lib/email.ts');
  assert.match(email, /GOOGLE_GMAIL_CLIENT_ID/);
  assert.match(email, /GOOGLE_GMAIL_REFRESH_TOKEN/);
  assert.match(email, /GOOGLE_GMAIL_SEND_ENABLED === 'true'/);
  assert.match(email, /const googleConfigured = Boolean\(googleMailCredentials\(\)\)/);
});

test('detail navigační objednávky hydratuje se serverovým datem a pevnými časovými pásmy', () => {
  const component = source('components/navigation/NavigationOrderDetailView.tsx');
  const page = source('app/navigation/orders/[id]/page.tsx');
  assert.match(component, /currentDate: string/);
  assert.match(component, /timeZone: 'Europe\/Prague'/);
  assert.match(component, /timeZone: 'UTC'/);
  assert.doesNotMatch(component, /toLocale(?:DateString|String)\('cs-CZ'/);
  assert.match(page, /currentDate=\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}/);
});

test('standardní nabídka zachová klienta předaného z CRM', () => {
  const page = source('app/offers/new/standard/page.tsx');
  const wizard = source('components/offers/OfferWizard.tsx');
  assert.match(page, /searchParams: Promise<\{ clientId\?: string \}>/);
  assert.match(page, /initialClientId=\{clientId\}/);
  assert.match(wizard, /initialClientId\?: string/);
  assert.match(wizard, /initialClients\.some\(\(client\) => client\.id === requestedClientId\)/);
});

test('Preview reakce z rezervované .invalid domény nikdy nespustí e-mailový provider', () => {
  const service = source('lib/offers/service.ts');
  assert.match(service, /process\.env\.VERCEL_ENV === 'preview'/);
  assert.match(service, /actorEmail\.toLowerCase\(\)\.endsWith\('\.invalid'\)/);
  assert.match(service, /if \(!suppressPreviewTestEmail\) try/);
});

test('tenantový AsyncLocalStorage zůstává singleton i v produkčním serverless bundlu', () => {
  const tenantContext = source('lib/tenant-context.ts');
  assert.match(tenantContext, /globalForTenant\.__seepointTenantStorage = storage/);
  assert.doesNotMatch(tenantContext, /NODE_ENV !== 'production'.*__seepointTenantStorage/);
});

test('převod přijaté nabídky obnoví tenantový kontext z ověřeného uživatele', () => {
  const service = source('lib/offers/service.ts');
  assert.match(service, /if \(!user\.organizationId\) throw new OfferValidationError\('Pro převod musí být zvolená aktivní organizace\.'/);
  assert.match(service, /runWithTenantContext\(\{ organizationId: user\.organizationId, userId: user\.id, source: 'session' \}, \(\) => prisma\.\$transaction/);
});
