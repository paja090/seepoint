import test from 'node:test';
import assert from 'node:assert/strict';
import { canReviewAcademy } from '../lib/academy/review-policy';
import lessons from '../lib/academy/review-lessons.json';
import media from '../lib/academy/review-media.json';
const actor = { id: 'reviewer', role: 'ADMIN', organizationId: 'cmui330fi0005l404dx9noytp', organization: { id: 'cmui330fi0005l404dx9noytp', isActive: true, plan: 'PRO', enabledModules: { offers: true } }, membership: { organizationId: 'cmui330fi0005l404dx9noytp', isActive: true } };
test('review is admin-only, scoped to approved organization and active membership', () => {
  assert.equal(canReviewAcademy(actor, 'preview'), true);
  assert.equal(canReviewAcademy(actor, 'production'), true);

  assert.equal(canReviewAcademy(null, 'preview'), false);
  assert.equal(canReviewAcademy({ ...actor, role: 'SALES' }, 'preview'), false);
  assert.equal(canReviewAcademy({ ...actor, organizationId: 'other' }, 'preview'), false);
  assert.equal(canReviewAcademy({ ...actor, membership: { ...actor.membership, isActive: false } }, 'preview'), false);
  assert.equal(canReviewAcademy({ ...actor, organization: { ...actor.organization, enabledModules: { offers: false } } }, 'preview'), false);
});
test('four curated lessons resolve all twelve JPEGs without public token links', () => {
  assert.equal(lessons.length, 4);
  assert.equal(Object.keys(media).length, 12);
  assert.ok(!JSON.stringify(lessons).includes('/offer/'));
  for (const lesson of lessons) for (const step of lesson.steps) for (const block of step.blocks) {
    if ('file' in block && block.file) {
      assert.ok(Object.hasOwn(media, block.file));
      assert.equal(Buffer.from(media[block.file as keyof typeof media], 'base64').subarray(0, 2).toString('hex'), 'ffd8');
    }
  }
});
