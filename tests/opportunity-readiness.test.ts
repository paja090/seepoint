import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { OpportunityStatus } from '@prisma/client';
import {
  OpportunityValidationError,
  assertOpportunityTransition,
  parseOpportunityCreateInput,
  parseOpportunityFilters,
  parseOpportunityStatusInput,
} from '../lib/opportunities/policy.ts';
import { assertPublicHttpUrl } from '../lib/opportunities/public-url.ts';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('opportunity create input validates lengths, enums, dates, URLs and GPS', () => {
  const parsed = parseOpportunityCreateInput({
    companyName: '  Test firma  ', title: 'Nová pobočka', summary: 'Ověřený podklad obchodníka',
    city: 'Ostrava', eventDate: '2099-10-01', website: 'https://example.cz', companyId: '12345678',
    latitude: 49.8, longitude: 18.2, suggestedMediaTypes: ['CITY_POSTER', 'UNKNOWN', 'CITY_POSTER'],
  });
  assert.equal(parsed.companyName, 'Test firma');
  assert.deepEqual(parsed.suggestedMediaTypes, ['CITY_POSTER']);
  assert.throws(() => parseOpportunityCreateInput({ companyName: 'X', title: 'Y', summary: 'Z', city: 'O', eventType: 'HACKED' }), OpportunityValidationError);
  assert.throws(() => parseOpportunityCreateInput({ companyName: 'X', title: 'Y', summary: 'Z', city: 'O', eventDate: '2020-01-01' }), /minulosti/);
  assert.throws(() => parseOpportunityCreateInput({ companyName: 'X', title: 'Y', summary: 'Z', city: 'O', website: 'javascript:alert(1)' }), OpportunityValidationError);
});

test('opportunity filters are bounded and reject invalid enum or scores', () => {
  const filters = parseOpportunityFilters(new URLSearchParams('take=100&skip=20&minScore=60&status=NEW'));
  assert.deepEqual({ take: filters.take, skip: filters.skip, minScore: filters.minScore, status: filters.status }, { take: 100, skip: 20, minScore: 60, status: 'NEW' });
  assert.throws(() => parseOpportunityFilters(new URLSearchParams('take=1000')), OpportunityValidationError);
  assert.throws(() => parseOpportunityFilters(new URLSearchParams('status=UNKNOWN')), OpportunityValidationError);
  assert.throws(() => parseOpportunityFilters(new URLSearchParams('minScore=90&maxScore=20')), OpportunityValidationError);
});

test('opportunity state machine and dismissal reason are enforced', () => {
  assert.doesNotThrow(() => assertOpportunityTransition(OpportunityStatus.NEW, OpportunityStatus.CONTACTED));
  assert.throws(() => assertOpportunityTransition(OpportunityStatus.CONVERTED, OpportunityStatus.NEW), /není povolen/);
  assert.throws(() => parseOpportunityStatusInput({ status: 'DISMISSED' }), /důvod/);
  assert.equal(parseOpportunityStatusInput({ status: 'DISMISSED', dismissedReason: 'Duplicitní zpráva' }).dismissedReason, 'Duplicitní zpráva');
});

test('article URL guard blocks loopback and private targets before fetch', async () => {
  await assert.rejects(() => assertPublicHttpUrl('http://127.0.0.1/admin'), /veřejnou adresu/);
  await assert.rejects(() => assertPublicHttpUrl('http://localhost:3000'), /Interní URL/);
  await assert.rejects(() => assertPublicHttpUrl('http://10.0.0.1'), /veřejnou adresu/);
  await assert.rejects(() => assertPublicHttpUrl('file:///etc/passwd'), /HTTP\(S\)/);
});

test('AI parser uses private server keys, one configured model and bounded external calls', () => {
  const parser = source('lib/opportunities/parser.ts');
  assert.doesNotMatch(parser, /NEXT_PUBLIC_(GEMINI|OPENAI)/);
  assert.match(parser, /fetchPublicArticle/);
  assert.match(parser, /AbortSignal\.timeout\(20_000\)/);
  assert.match(parser, /GEMINI_OPPORTUNITY_MODEL/);
  assert.match(parser, /x-goog-api-key/);
  assert.doesNotMatch(parser, /generateContent\?key=/);
});

test('opportunity APIs scope tenants, rate-limit AI and restrict bulk discovery', () => {
  const service = source('lib/opportunities/service.ts');
  const parseRoute = source('app/api/sales/opportunities/parse-input/route.ts');
  const discovery = source('app/api/sales/opportunities/auto-discover/route.ts');
  const scheduled = source('app/api/sales/opportunities/scheduled-discovery/route.ts');
  const collector = source('lib/opportunities/feed-collector.ts');
  assert.match(service, /organizationId/);
  assert.match(service, /organizationMember\.count/);
  assert.match(parseRoute, /rateLimitPolicies\.opportunityAi/);
  for (const route of [discovery, scheduled]) {
    assert.match(route, /\['ADMIN', 'MANAGER'\]\.includes\(user\.role\)/);
    assert.match(route, /rateLimitPolicies\.opportunityDiscovery/);
  }
  assert.match(scheduled, /nejvýše 25 signálů/);
  assert.match(collector, /45 \* 24 \* 60 \* 60_000/);
  assert.match(discovery, /\.slice\(0, 5\)/);
});

test('CRM linking is serializable, tenant checked and audited without using article URL as company website', () => {
  const route = source('app/api/sales/opportunities/[id]/link-crm/route.ts');
  assert.match(route, /TransactionIsolationLevel\.Serializable/);
  assert.match(route, /organizationId: user\.organizationId/);
  assert.match(route, /crmAuditLog\.create/);
  assert.match(route, /website: opportunity\.website \|\| null/);
  assert.doesNotMatch(route, /website: opportunity\.website \|\| opportunity\.sourceUrl/);
});

test('multi-tenant OOH scoring calculates 6 dimensions and awards points for tenant target region', async () => {
  const { calculateOpportunityScore } = await import('../lib/opportunities/scoring.ts');
  
  // Case A: Praha tenant target region
  const prahaResult = calculateOpportunityScore({
    eventType: 'STORE_OPENING',
    city: 'Praha',
    region: 'Hlavní město Praha',
    targetCities: ['Praha'],
    targetRegions: ['Hlavní město Praha'],
    carrierCountInCity: 5,
    suggestedMediaTypes: ['BILLBOARD', 'CITYLIGHT'],
    preferredMediaTypes: ['BILLBOARD', 'CITYLIGHT'],
    hasVerifiedEvidence: true,
  });

  assert.equal(prahaResult.breakdown.trigger, 25);
  assert.ok(prahaResult.breakdown.geo >= 20, 'Praha should receive geo points based on tenant target region and inventory');
  assert.ok(prahaResult.breakdown.mediaFit >= 10, 'Matching preferred OOH media types should award mediaFit points');
  assert.ok(prahaResult.score >= 50);

  // Case B: Null city yields 0 geo points without falling back to Ostrava
  const nullCityResult = calculateOpportunityScore({
    eventType: 'STORE_OPENING',
    city: null,
    region: null,
    targetCities: ['Ostrava'],
    targetRegions: ['Moravskoslezský kraj'],
  });
  assert.equal(nullCityResult.breakdown.geo, 0, 'Unknown location must yield 0 geo points');
});

test('parser does not contain hardcoded SeePOINT or MS region and accepts nullable city', () => {
  const parser = source('lib/opportunities/parser.ts');
  assert.doesNotMatch(parser, /SeePOINT \(seepoint\.cz\)/);
  assert.doesNotMatch(parser, /\|\|\s*'Ostrava'/);
  assert.doesNotMatch(parser, /\|\|\s*'Moravskoslezský kraj'/);
  assert.match(parser, /"city":\s*null/);
  assert.match(parser, /"region":\s*null/);
  assert.match(parser, /city\s*,\s*region/);
});

test('distance calculator computes Haversine distance in kilometers accurately', async () => {
  const { calculateHaversineDistanceKm } = await import('../lib/opportunities/distance.ts');
  // Distance between Ostrava (49.82, 18.26) and Opava (49.93, 17.90) is approx 28-30 km
  const dist = calculateHaversineDistanceKm(49.8209, 18.2625, 49.9387, 17.9026);
  assert.ok(dist >= 25 && dist <= 35, `Distance was ${dist}`);
});

