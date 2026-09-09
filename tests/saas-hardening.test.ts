import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { SYSTEM_MODULES, PLAN_MODULE_PRESETS, getModuleIdForPath, isModuleEnabled } from '../lib/organization-modules';
import { hasModuleAccess } from '../lib/module-policy';
import { scopeTenantQuery } from '../lib/tenant-prisma';
import { runWithTenantContext } from '../lib/tenant-context';
import { preparePortalCredential, recoverPortalToken, hashPublicOfferToken, encryptPortalToken } from '../lib/offers/token';
import { assertPrintProductionTransition, validatePrintJob, safeArtworkUrl, productionKpis } from '../lib/production/production-policy';
import { assertTenantResult } from '../lib/tenant-result';
import { vehicleDeadlines } from '../lib/vehicle-deadlines';
import { overlapsAbsence } from '../lib/work-absence-conflicts';

test('public graph rejects historical cross-tenant relations and planning uses real dates', () => {
  assert.throws(() => assertTenantResult({ organizationId: 'a', printJobs: [{ organizationId: 'b' }] }, 'a'));
  assertTenantResult({ organizationId: 'a', printJobs: [{ organizationId: 'a' }] }, 'a');
  const day = new Date('2026-09-07T00:00:00Z');
  assert.equal(overlapsAbsence(new Date('2026-09-07T15:00:00Z'), null, { dateFrom: day, dateTo: day }), true);
  assert.equal(overlapsAbsence(new Date('2026-09-08T00:00:00Z'), null, { dateFrom: day, dateTo: day }), false);
  assert.equal(vehicleDeadlines({ technicalInspectionUntil: null, insuranceUntil: null, highwayPassUntil: null }, day).length, 0);
  const due = vehicleDeadlines({ technicalInspectionUntil: new Date(+day - 86400000), insuranceUntil: new Date(+day + 10 * 86400000), highwayPassUntil: new Date(+day + 90 * 86400000) }, day);
  assert.deepEqual(due.map(d => d.overdue), [true, false]);
});

test('module IDs, exact routes and plan entries are unique and fail closed', () => {
  assert.equal(new Set(SYSTEM_MODULES.map(m => m.id)).size, SYSTEM_MODULES.length);
  const routes = SYSTEM_MODULES.flatMap(m => m.routes);
  assert.equal(new Set(routes).size, routes.length);
  for (const entries of Object.values(PLAN_MODULE_PRESETS)) {
    assert.equal(new Set(entries).size, entries.length);
    for (const id of entries) assert.ok(SYSTEM_MODULES.some(m => m.id === id));
  }
  assert.equal(getModuleIdForPath('/work/route'), 'workRoute');
  assert.equal(isModuleEnabled({ plan: 'UNKNOWN' }, 'warehouse'), false);
  assert.equal(isModuleEnabled(null, 'warehouse'), false);
});
test('disabled module, inactive membership, mismatched tenant and RBAC deny access', () => {
  const user = { role: 'ADMIN', organizationId: 'a', organization: { id: 'a', isActive: true, plan: 'START' }, membership: { organizationId: 'a', isActive: true } };
  assert.equal(hasModuleAccess(user, 'warehouse'), false);
  user.organization.plan = 'PRO';
  assert.equal(hasModuleAccess(user, 'warehouse'), true);
  assert.equal(hasModuleAccess({ ...user, role: 'VIEWER' }, 'warehouse'), false);
  assert.equal(hasModuleAccess({ ...user, membership: { organizationId: 'b', isActive: true } }, 'warehouse'), false);
  assert.equal(hasModuleAccess({ ...user, membership: { organizationId: 'a', isActive: false } }, 'warehouse'), false);
  for (const file of ['lib/page-auth.ts', 'lib/api-auth.ts', 'lib/module-access.ts']) assert.match(readFileSync(file, 'utf8'), /hasModuleAccess\(user, moduleId(?:, section)?\)/);
  assert.match(readFileSync('app/production/actions.ts', 'utf8'), /requireModuleAccess\('printProduction'\)/);
});
test('PrintProductionJob reads and writes cannot address tenant B from tenant A', () => {
  runWithTenantContext({ organizationId: 'a', source: 'test' }, () => {
    for (const operation of ['findUnique', 'findMany', 'update', 'updateMany', 'delete']) {
      const scoped = scopeTenantQuery('PrintProductionJob', operation, { where: { id: 'job-b' } }) as { where: { organizationId: string } };
      assert.equal(scoped.where.organizationId, 'a');
      assert.throws(() => scopeTenantQuery('PrintProductionJob', operation, { where: { organizationId: 'b' } }));
    }
  });
  assert.throws(() => scopeTenantQuery('PrintProductionJob', 'findMany', {}));
});
test('permanent credentials survive workflow, encryption-key rotation and legacy migration', () => {
  const saved = { keys: process.env.OFFER_PORTAL_KEYS, active: process.env.OFFER_PORTAL_ACTIVE_KEY };
  try {
    process.env.OFFER_PORTAL_KEYS = JSON.stringify({ first: Buffer.alloc(32, 1).toString('base64'), second: Buffer.alloc(32, 2).toString('base64') });
    process.env.OFFER_PORTAL_ACTIVE_KEY = 'first';
    const first = preparePortalCredential({ id: 'offer', publicTokenHash: null });
    const row = { id: 'offer', publicTokenHash: first.hash, publicTokenEncrypted: first.encrypted };
    for (const stage of ['SENT', 'ACCEPTED', 'CONVERTED', 'PRODUCTION_CREATED', 'IN_PRINT', 'INSTALLED', 'PHOTO_ADDED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']) {
      assert.equal(preparePortalCredential({ ...row, ...{ status: stage } }).token, first.token);
    }
    process.env.OFFER_PORTAL_ACTIVE_KEY = 'second';
    assert.equal(recoverPortalToken(row), first.token);
    const reencrypted = encryptPortalToken(first.token, row.id);
    assert.equal(recoverPortalToken({ ...row, publicTokenEncrypted: reencrypted }), first.token);
    assert.equal(recoverPortalToken({ ...row, id: 'other' }), null);
    assert.equal(recoverPortalToken({ ...row, publicTokenRevokedAt: new Date() }), null);
    assert.throws(() => preparePortalCredential({ ...row, publicTokenRevokedAt: new Date() }));
    const legacy = createHmac('sha256', 'seepoint-offer-token-salt-2026').update('offer:legacy').digest('base64url');
    const migrated = preparePortalCredential({ id: 'legacy', publicTokenHash: hashPublicOfferToken(legacy) });
    assert.equal(migrated.token, legacy);
    assert.equal(migrated.hash, hashPublicOfferToken(legacy));
    assert.throws(() => preparePortalCredential({ id: 'unrecoverable', publicTokenHash: first.hash }));
  } finally {
    if (saved.keys === undefined) delete process.env.OFFER_PORTAL_KEYS; else process.env.OFFER_PORTAL_KEYS = saved.keys;
    if (saved.active === undefined) delete process.env.OFFER_PORTAL_ACTIVE_KEY; else process.env.OFFER_PORTAL_ACTIVE_KEY = saved.active;
  }
});
test('production runtime validation and transitions reject unsafe input', () => {
  const valid = { title: 'Job', formatType: 'CLP', materialType: 'CITYLIGHT_PAPER', quantity: 1, sparesQuantity: 0 };
  assert.equal(validatePrintJob({ ...valid, organizationId: 'evil' }).status, 'PREPARATION');
  assert.equal('organizationId' in validatePrintJob({ ...valid, organizationId: 'evil' }), false);
  for (const raw of [{ ...valid, quantity: -1 }, { ...valid, status: 'IN_PRINT' }, { ...valid, artworkUrl: 'javascript:alert(1)' }, { ...valid, deliveryDeadline: 'bad' }]) assert.throws(() => validatePrintJob(raw));
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com']) assert.throws(() => safeArtworkUrl(url));
  assert.equal(safeArtworkUrl('https://example.com/artwork'), 'https://example.com/artwork');
  assertPrintProductionTransition('CLIENT_APPROVAL', 'IN_PRINT');
  assert.throws(() => assertPrintProductionTransition('PREPARATION', 'IN_PRINT'));
  assert.throws(() => assertPrintProductionTransition('DELIVERED_TO_WAREHOUSE', 'PREPARATION'));
  assert.throws(() => assertPrintProductionTransition('IN_PRINT', 'IN_PRINT'));
  const now = new Date('2026-09-07T00:00:00Z');
  assert.equal(productionKpis([{ status: 'IN_PRINT', deliveryDeadline: new Date(+now - 1) }, { status: 'IN_PRINT', deliveryDeadline: new Date(+now + 1) }, { status: 'DELIVERED_TO_WAREHOUSE', deliveryDeadline: new Date(+now + 1) }], now).dueSoon, 1);
});
