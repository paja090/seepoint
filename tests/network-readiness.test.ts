import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('B2B transactional endpoints never return simulated business records or successful writes', () => {
  for (const resource of ['holds', 'notifications', 'proofs', 'settlements', 'demands']) {
    const source = read(`app/api/network/${resource}/route.ts`);
    assert.match(source, /configured: false/);
    assert.match(source, /status: 501/);
    assert.doesNotMatch(source, /sample|Date\.now\(\)|Math\.random\(\)|Outdoor Media Brno|SeePOINT Praha/);
  }
});

test('B2B partner state and KPIs never invent connection state or inventory totals', () => {
  const partners = read('app/api/network/partners/route.ts');
  const view = read('components/network/NetworkHubView.tsx');
  assert.match(partners, /configured: false/);
  assert.match(partners, /partners: \[\]/);
  assert.doesNotMatch(partners, /organization\.findMany|platformPrisma/);
  assert.doesNotMatch(partners, /index % 2|12 \+ index|Simulated active connection/);
  assert.doesNotMatch(view, /partnerSurfacesCount \+ 24/);
  assert.match(view, /NETWORK_BETA_MESSAGE/);
  assert.doesNotMatch(view, /mezi ověřenými outdoorovými agenturami|se 100% ochranou/);
  assert.doesNotMatch(view, /bid-\$\{Date\.now\(\)\}|B2B-2026-0899/);
  assert.doesNotMatch(view, /setActionSuccess\('/);
  assert.match(view, /disabled=\{!NETWORK_TRANSACTIONS_ENABLED\}/);
  assert.match(view, /Zobrazené nuly proto nemusí znamenat prázdná data/);
});

test('carrier overviews exclude binary photo content and bound the default page size', () => {
  const db = read('lib/db.ts');
  assert.match(db, /const photoMetadataSelect/);
  assert.doesNotMatch(db.slice(db.indexOf('const photoMetadataSelect'), db.indexOf('export const carrierInclude')), /content:\s*true/);
  assert.match(db, /filters\.pageSize \?\? 100/);
  assert.match(db, /carrierOverviewInclude\(new Date\(\), true\)/);
});

test('B2B inventory requires explicit sharing on both carrier and surface and never exposes private photos', () => {
  const inventory = read('app/api/network/inventory/route.ts');
  const partners = read('app/api/network/partners/route.ts');
  assert.match(inventory, /const ownVisibility = networkVisibilities\.includes/);
  assert.match(inventory, /organizationId: \{ not: organizationId \}, visibility: 'MARKETPLACE'/);
  assert.match(inventory, /isPrivate: false, isClientVisible: true/);
  assert.doesNotMatch(inventory, /: 8500/);
  assert.doesNotMatch(inventory, /requireTenantContext/);
  assert.doesNotMatch(partners, /requireTenantContext/);
  assert.match(inventory, /auth\.organizationId/);
});

test('B2B directory does not disclose tenant contact details before persistent partnership exists', () => {
  const partners = read('app/api/network/partners/route.ts');
  assert.doesNotMatch(partners, /email: true|phone: true/);
  assert.doesNotMatch(partners, /email: org\.email|phone: org\.phone/);
});

test('B2B 1-click visibility management and ARES self-service onboarding enforce tenant isolation', () => {
  const visibility = read('app/api/network/visibility/route.ts');
  const joinNetwork = read('app/join-network/page.tsx');
  assert.match(visibility, /requireApiAccess\('offers', 'network'\)/);
  assert.match(visibility, /auth\.organizationId/);
  assert.doesNotMatch(visibility, /platformPrisma/);
  assert.match(visibility, /SET_SURFACE_VISIBILITY/);
  assert.match(visibility, /BULK_SET_VISIBILITY/);
  assert.match(joinNetwork, /aresIco=/);
  assert.match(joinNetwork, /B2B_PARTNER_NETWORK/);
});

test('B2B White-label agency mode, interactive map, and 1-click CSV/Excel media-plan export are wired in catalog and network hub', () => {
  const catalogView = read('components/client-catalog/PublicInventoryCatalogView.tsx');
  const networkView = read('components/network/NetworkHubView.tsx');
  const networkMap = read('components/network/NetworkInteractiveMap.tsx');
  assert.match(catalogView, /whitelabel/);
  assert.match(catalogView, /!isWhiteLabel && organization && \(organization\.phone \|\| organization\.email\)/);
  assert.match(catalogView, /handleExportCatalogCsv/);
  assert.match(networkView, /handleCopyWhiteLabelLink/);
  assert.match(networkView, /handleExportB2bCsv/);
  assert.match(networkView, /NetworkInteractiveMap/);
  assert.match(networkMap, /__b2bToggleSurface/);
  assert.match(catalogView, /localityHighlights/);
  assert.match(networkView, /UPDATE_SURFACE_DETAILS/);
  assert.match(networkMap, /localityHighlights/);
});





