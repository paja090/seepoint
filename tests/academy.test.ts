import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { getVisibleNavigation } from '../lib/navigation';
import { hasModuleAccess } from '../lib/module-policy';
import { roles } from '../lib/rbac';
import { canReadAcademy, canManageAcademy, canUseLesson, canReadRevision, matchesAcademySearch, parseAcademyFeedback, type AcademyActor } from '../lib/academy/policy';
import { academyPilots, parseAcademyContent } from '../lib/academy/content';
import { runWithTenantContext } from '../lib/tenant-context';
import { scopeTenantQuery } from '../lib/tenant-prisma';

const actor = (role = 'ADMIN', enabled = true): AcademyActor => ({ id: 'user-a', role, organizationId: 'org-a', organization: { id: 'org-a', isActive: true, plan: 'PRO', enabledModules: { academy: enabled } }, membership: { organizationId: 'org-a', isActive: true } });
const revision = { organizationId: 'org-a', capability: 'basics', status: 'PUBLISHED', verifiedAt: new Date(), publishedAt: new Date(), archivedAt: null };
test('Academy requires explicit tenant flag and active matching membership for every role', () => {
  for (const role of roles) { assert.equal(canReadAcademy(actor(role)), true); assert.equal(canReadAcademy(actor(role, false)), false); }
  assert.equal(canReadAcademy({ ...actor(), membership: { organizationId: 'org-b', isActive: true } }), false);
  assert.equal(canReadAcademy({ ...actor(), organization: { ...actor().organization!, isActive: false } }), false);
  assert.equal(canReadAcademy({ ...actor(), role: 'UNKNOWN' }), false);
});
test('drafts are admin-only and cannot bypass capability, module, tenant or archival checks', () => {
  for (const role of roles) {
    assert.equal(canManageAcademy(actor(role)), role === 'ADMIN');
    assert.equal(canReadRevision(actor(role), { ...revision, status: 'MEDIA_PENDING' }), false);
    assert.equal(canReadRevision(actor(role), { ...revision, status: 'MEDIA_PENDING' }, true), role === 'ADMIN');
  }
  assert.equal(canReadRevision(actor(), { ...revision, organizationId: 'org-b' }, true), false);
  assert.equal(canReadRevision(actor(), { ...revision, archivedAt: new Date() }, true), false);
  assert.equal(canReadRevision(actor(), { ...revision, verifiedAt: null }), false);
  assert.equal(canReadRevision(actor(), { ...revision, publishedAt: null }), false);
  assert.equal(canReadRevision(actor(), { ...revision, capability: 'invented' }, true), false);
  assert.equal(canReadRevision(actor('WORKER'), { ...revision, capability: 'navigationHandoff' }), false);
  assert.equal(canUseLesson(actor('VIEWER'), 'fieldPhoto'), false);
  assert.equal(canUseLesson(actor('SALES'), 'navigationHandoff'), false);
  assert.equal(canUseLesson(actor('TECHNICIAN'), 'fieldSurvey'), true);
});
test('inactive domain module removes lesson even with Academy enabled', () => {
  const user = actor(); user.organization!.enabledModules = { academy: true, carriers: false, navigation: false, offers: false };
  assert.equal(canUseLesson(user, 'fieldPhoto'), false);
  assert.equal(canUseLesson(user, 'fieldSurvey'), false);
  assert.equal(canUseLesson(user, 'navigationSelection'), false);
  assert.equal(canUseLesson(user, 'basics'), true);
});
test('all five pilots have valid unique steps and unambiguous content', () => {
  assert.equal(academyPilots.length, 5);
  assert.equal(new Set(academyPilots.map(p => p.slug)).size, 5);
  for (const pilot of academyPilots) assert.ok(parseAcademyContent(pilot.content).steps.length >= 3);
  const broken = { ...academyPilots[0].content, steps: [academyPilots[0].content.steps[0], academyPilots[0].content.steps[0]] };
  assert.throws(() => parseAcademyContent(broken));
  assert.throws(() => parseAcademyContent({ steps: '<script>' }));
});
test('Czech search handles accents and all query words', () => {
  assert.equal(matchesAcademySearch('Vyfotit nosič s GPS', 'nosic gps'), true);
  assert.equal(matchesAcademySearch('Vyfotit nosič s GPS', 'faktura'), false);
});
test('feedback limits input and discards forged ownership fields', () => {
  const parsed = parseAcademyFeedback({ revisionId: 'rev-a', category: 'BROKEN', message: ' Tlačítko nefunguje ', organizationId: 'org-b', reporterUserId: 'someone' });
  assert.equal(parsed.message, 'Tlačítko nefunguje');
  assert.equal('organizationId' in parsed, false); assert.equal('reporterUserId' in parsed, false);
  for (const message of ['', '1234', 'a'.repeat(2001)]) assert.throws(() => parseAcademyFeedback({ revisionId: 'r', category: 'BROKEN', message }));
  assert.throws(() => parseAcademyFeedback({ revisionId: 'r', category: 'OTHER', message: 'detail' }));
});
test('Academy models participate in tenant query scoping', () => {
  for (const model of ['AcademyCategory', 'AcademyLesson', 'AcademyLessonRevision', 'AcademyFeedback']) {
    const args = runWithTenantContext({ organizationId: 'org-a', source: 'test' }, () => scopeTenantQuery(model, 'findMany', {})) as { where: { organizationId: string } };
    assert.equal(args.where.organizationId, 'org-a');
    assert.throws(() => runWithTenantContext({ organizationId: 'org-a', source: 'test' }, () => scopeTenantQuery(model, 'findMany', { where: { organizationId: 'org-b' } })));
  }
});
test('public campaign portal reaches token validation but Academy stays protected', () => {
  assert.equal(middleware(new NextRequest('https://example.test/p/synthetic-token')).headers.get('x-middleware-next'), '1');
  assert.equal(middleware(new NextRequest('https://example.test/academy')).status, 307);
  assert.equal(middleware(new NextRequest('https://example.test/p-private')).status, 307);
});
test('warehouse navigation matches section and realization honors existing work fallback', () => {
  assert.equal(getVisibleNavigation({ role: 'ADMIN', organization: null }).flatMap(h => h.groups.flatMap(g => g.items)).some(i => i[0] === '/academy'), false);
  const items = (user: ReturnType<typeof actor>) => getVisibleNavigation(user as Parameters<typeof getVisibleNavigation>[0]).flatMap(h => h.groups.flatMap(g => g.items));
  assert.equal(items(actor('SALES')).some(i => i[0] === '/warehouse'), false);
  assert.equal(items(actor('WORKER')).some(i => i[0] === '/warehouse'), true);
  const manager = actor('MANAGER'); manager.organization!.enabledModules = { work: true, aiRealization: false };
  assert.equal(hasModuleAccess(manager, 'aiRealization', 'realization'), true);
  assert.equal(items(manager).some(i => i[0] === '/realization'), true);
});
