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
  assert.match(service, /organizationId/);
  assert.match(service, /organizationMember\.count/);
  assert.match(parseRoute, /rateLimitPolicies\.opportunityAi/);
  for (const route of [discovery, scheduled]) {
    assert.match(route, /\['ADMIN', 'MANAGER'\]\.includes\(user\.role\)/);
    assert.match(route, /rateLimitPolicies\.opportunityDiscovery/);
  }
  assert.match(scheduled, /nejvýše 25 signálů/);
  assert.match(discovery, /45 \* 24 \* 60 \* 60_000/);
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
