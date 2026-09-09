import test from 'node:test';
import assert from 'node:assert/strict';

test('navigation conversion preserves shared site photo and is idempotent in PostgreSQL', { skip: process.env.RUN_NAV_CONVERSION_DB !== '1' }, async () => {
  assert.equal(new URL(process.env.DATABASE_URL || '').hostname, 'ep-hidden-sun-atmqlsxn.c-9.us-east-1.aws.neon.tech');
  const { platformPrisma } = await import('../lib/db.ts');
  const { convertOfferToNavigationOrderInTransaction } = await import('../lib/navigation/navigation-service.ts');
  const { runWithTenantContext } = await import('../lib/tenant-context.ts');
  const organizationId = 'cmtrswggu0000u8bo2qx2h3q1';
  const rollback = new Error('TEST_ROLLBACK');
  try {
    const member = await platformPrisma.organizationMember.findFirstOrThrow({ where: { organizationId }, include: { user: true } });
    const client = await platformPrisma.client.findFirstOrThrow({ where: { organizationId } });
    await assert.rejects(runWithTenantContext({ organizationId, userId: member.userId, source: 'test' }, () => platformPrisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({ data: { organizationId, clientId: client.id, title: 'Conversion regression', offerType: 'NAVIGATION', createdByUserId: member.userId } });
      const nav = await tx.navigationOffer.create({ data: { organizationId, offerId: offer.id, targetName: 'Test', targetLatitude: 49.8, targetLongitude: 18.2 } });
      const photo = await tx.photo.create({ data: { organizationId, url: '/test-only-photo', type: 'SURVEY' } });
      const source = await tx.navigationPoint.create({ data: { organizationId, navigationOfferId: nav.id, latitude: 49.8, longitude: 18.2, label: 'NAV-test', navigationType: 'NAVIGATION', sitePhotoId: photo.id } });
      const actor = { id: member.userId, email: member.user.email };
      const order = await convertOfferToNavigationOrderInTransaction(tx, offer.id, actor);
      const repeated = await convertOfferToNavigationOrderInTransaction(tx, offer.id, actor);
      assert.equal(repeated.id, order.id);
      const points = await tx.navigationPoint.findMany({ where: { organizationId, sitePhotoId: photo.id } });
      assert.equal(points.length, 2);
      assert.ok(points.some(p => p.id === source.id && p.navigationOfferId === nav.id));
      assert.ok(points.some(p => p.navigationOrderId === order.id));
      assert.equal(await tx.crmOrder.count({ where: { organizationId, offerId: offer.id } }), 1);
      assert.equal((await tx.offer.findUniqueOrThrow({ where: { id: offer.id } })).status, 'ACCEPTED');
      throw rollback;
    }, { timeout: 30000 })), error => error === rollback);
  } finally { await platformPrisma.$disconnect(); }
});
