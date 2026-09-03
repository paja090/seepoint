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
  assert.match(partners, /status: 'AVAILABLE'/);
  assert.match(partners, /sharedSurfacesCount: 0/);
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
