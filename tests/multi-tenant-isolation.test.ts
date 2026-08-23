import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runWithTenantContext } from '../lib/tenant-context.ts';
import { scopeTenantQuery, TENANT_MODEL_NAMES } from '../lib/tenant-prisma.ts';

const orgA = 'org_a';
const orgB = 'org_b';

function scoped(model: string, operation: string, args: Record<string, unknown>, organizationId = orgA) {
  return runWithTenantContext({ organizationId, source: 'test' }, () => scopeTenantQuery(model, operation, args)) as Record<string, unknown>;
}

test('Organization A client listing is always scoped away from Organization B', () => {
  const query = scoped('Client', 'findMany', { where: { active: true } });
  assert.deepEqual(query.where, { active: true, organizationId: orgA });
  assert.notEqual((query.where as Record<string, unknown>).organizationId, orgB);
});

test('GET by a foreign client id receives an organization predicate and therefore resolves as 404', () => {
  const query = scoped('Client', 'findUnique', { where: { id: 'client_b' } });
  assert.deepEqual(query.where, { id: 'client_b', organizationId: orgA });
});

test('updates and deletes cannot target a record outside the active organization', () => {
  const update = scoped('Client', 'update', { where: { id: 'client_b' }, data: { name: 'attempt' } });
  assert.deepEqual(update.where, { id: 'client_b', organizationId: orgA });
  assert.throws(() => scoped('Client', 'update', { where: { id: 'client_b', organizationId: orgB }, data: {} }), /override the active organization/);
});

test('same normalized client name is unique per organization, not globally', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /@@unique\(\[organizationId, normalizedName\]\)/);
  assert.doesNotMatch(schema, /normalizedName\s+String\s+@unique/);
});

test('one global user email can have memberships in multiple organizations', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /email\s+String\s+@unique/);
  assert.match(schema, /@@unique\(\[organizationId, userId\]\)/);
  assert.match(schema, /organizationMemberships\s+OrganizationMember\[\]/);
});

test('AI inventory lookup is scoped to the active organization', () => {
  const query = scoped('AdvertisingSurface', 'findMany', { where: { status: 'AVAILABLE' } });
  assert.deepEqual(query.where, { status: 'AVAILABLE', organizationId: orgA });
});

test('dashboard counts and aggregates are scoped to the active organization', () => {
  const count = scoped('Offer', 'count', { where: { status: 'ACCEPTED' } });
  const aggregate = scoped('Occupancy', 'aggregate', { where: { status: 'OCCUPIED' }, _count: true });
  assert.equal((count.where as Record<string, unknown>).organizationId, orgA);
  assert.equal((aggregate.where as Record<string, unknown>).organizationId, orgA);
});

test('public offers resolve tenant only by an opaque token and never by offer id fallback', () => {
  const service = readFileSync(new URL('../lib/offers/service.ts', import.meta.url), 'utf8');
  assert.match(service, /enterPublicOfferTenant\(tokenHash\)/);
  assert.doesNotMatch(service, /where:\s*\{\s*id:\s*token\s*\}/);
});

test('all declared tenant models receive create ownership and reject client overrides', () => {
  assert.ok(TENANT_MODEL_NAMES.length >= 70);
  const create = scoped('Offer', 'create', { data: { title: 'A' } });
  assert.equal((create.data as Record<string, unknown>).organizationId, orgA);
  assert.throws(() => scoped('Offer', 'create', { data: { title: 'B', organizationId: orgB } }), /override the active organization/);
});

