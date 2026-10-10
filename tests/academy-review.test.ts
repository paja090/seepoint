import test from 'node:test';
import assert from 'node:assert/strict';
import { canReviewAcademy, canReadSharedLesson, canReadSharedMedia } from '../lib/academy/review-policy';
import { getVisibleNavigation } from '../lib/navigation';
import { roles } from '../lib/rbac';
import lessons from '../lib/academy/review-lessons.json';
import media from '../lib/academy/review-media.json';
const actor = { id: 'reader', role: 'ADMIN', organizationId: 'agency-new', organization: { id: 'agency-new', isActive: true, plan: 'PRO', enabledModules: { academy: false, offers: true, crm: true } }, membership: { organizationId: 'agency-new', isActive: true } };
test('shared catalog is available to every active agency and known role without enabling tenant editor', () => {
  for (const role of roles) {
    assert.equal(canReviewAcademy({ ...actor, role }), true);
    assert.ok(getVisibleNavigation({ ...actor, role, membership: null }).flatMap(h => h.groups.flatMap(g => g.items)).some(i => i[0] === '/academy'));
  }
  for (const invalid of [null, { ...actor, role: 'UNKNOWN' }, { ...actor, organizationId: 'other' }, { ...actor, membership: { ...actor.membership, isActive: false } }, { ...actor, membership: { ...actor.membership, organizationId: 'other' } }, { ...actor, organization: { ...actor.organization, isActive: false } }]) assert.equal(canReviewAcademy(invalid), false);
});
test('lesson and direct media access enforce domain role and module permissions', () => {
  assert.equal(canReadSharedLesson(actor, 'offers'), true);
  assert.equal(canReadSharedLesson({ ...actor, role: 'SALES' }, 'offers'), true);
  assert.equal(canReadSharedLesson({ ...actor, role: 'WORKER' }, 'offers'), false);
  assert.equal(canReadSharedLesson(actor, 'invented'), false);
  const crmOnly = { ...actor, organization: { ...actor.organization, enabledModules: { academy: false, offers: false, crm: true } } };
  assert.equal(canReadSharedLesson(crmOnly, 'offers'), false);
  assert.equal(canReadSharedLesson(crmOnly, 'crm'), true);
  assert.equal(canReadSharedMedia(crmOnly, '17-hledani-klienta.jpg', lessons), true);
  assert.equal(canReadSharedMedia(crmOnly, '15-satelitni-mapa.jpg', lessons), false);
  assert.equal(canReadSharedMedia(null, '17-hledani-klienta.jpg', lessons), false);
  assert.equal(canReadSharedMedia(actor, '../secret.jpg', lessons), false);
});
test('twelve curated lessons resolve their JPEGs and disclose verification limits', () => {
  assert.equal(lessons.length, 12);
  assert.equal(Object.keys(media).length, 19);
  assert.ok(!JSON.stringify(lessons).includes('/offer/'));
  const used = new Set<string>();
  for (const lesson of lessons) {
    assert.ok(['PUBLISHED', 'MEDIA_PENDING'].includes(lesson.status));
    assert.ok(lesson.verification.length > 20);
    assert.ok(lesson.route.startsWith('/') && !lesson.route.startsWith('//'));
    assert.ok(lesson.steps.length > 0);
    for (const step of lesson.steps) for (const block of step.blocks) if ('file' in block && block.file) {
      used.add(block.file);
      assert.ok(Object.hasOwn(media, block.file));
      assert.equal(Buffer.from(media[block.file as keyof typeof media], 'base64').subarray(0, 2).toString('hex'), 'ffd8');
    }
  }
  assert.deepEqual([...used].sort(), Object.keys(media).sort());
  assert.ok(!used.has('14-platnost-overena.jpg'));
});
test('onboarding tutorials distinguish platform, organization and employee authority', () => {
  const admin = { ...actor, membership: { ...actor.membership, role: 'ADMIN', roles: ['ADMIN'] } };
  assert.equal(canReadSharedLesson(admin, 'organizationAdmin'), true);
  assert.equal(canReadSharedLesson({ ...admin, membership: { ...admin.membership, role: 'OWNER', roles: ['OWNER'] } }, 'organizationAdmin'), true);
  assert.equal(canReadSharedLesson(actor, 'organizationAdmin'), false);
  assert.equal(canReadSharedLesson(admin, 'platformAdmin'), false);
  assert.equal(canReadSharedLesson({ ...admin, platformRole: 'SUPER_ADMIN' }, 'platformAdmin'), true);
  assert.equal(canReadSharedLesson({ ...admin, role: 'WORKER', membership: { ...admin.membership, role: 'WORKER', roles: ['WORKER'] } }, 'employees'), false);
  assert.equal(canReadSharedLesson({ ...admin, role: 'MANAGER' }, 'employees'), true);
  assert.equal(canReadSharedMedia(actor, '21-firemni-udaje.jpg', lessons), false);
  assert.equal(canReadSharedMedia(admin, '21-firemni-udaje.jpg', lessons), true);
  assert.equal(canReadSharedMedia({ ...admin, organizationId: 'another' }, '21-firemni-udaje.jpg', lessons), false);
});
