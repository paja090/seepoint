import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { hashPassword } from '../lib/auth-crypto';
import { preparePortalCredential } from '../lib/offers/token';

config({ path: '.env.local' });
async function main() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (process.env.E2E_ALLOW_TEST_TENANT !== 'true' || process.env.VERCEL_ENV === 'production'
    || !process.env.E2E_DATABASE_HOST || host !== process.env.E2E_DATABASE_HOST) {
    throw new Error('Explicit disposable database hostname and test authorization required.');
  }
  const db = new PrismaClient();
  try {
    const suffix = randomBytes(6).toString('hex');
    const password = `Test-${randomBytes(24).toString('base64url')}9`;
    const passwordHash = await hashPassword(password);
    const fixtures = await db.$transaction(async tx => {
      const result = [];
      for (const [name, plan] of [['A', 'PRO'], ['B', 'PRO'], ['START', 'START']] as const) {
        const organization = await tx.organization.create({ data: { name: `Hardening E2E ${name} ${suffix}`, slug: `hardening-${name.toLowerCase()}-${suffix}`, plan } });
        const user = await tx.user.create({ data: { name: `Hardening ${name}`, email: `hardening-${name.toLowerCase()}-${suffix}@example.invalid`, passwordHash, status: 'ACTIVE', role: 'ADMIN' } });
        await tx.organizationMember.create({ data: { organizationId: organization.id, userId: user.id, role: 'OWNER' } });
        const client = await tx.client.create({ data: { organizationId: organization.id, name: `E2E Client ${name} ${suffix}`, normalizedName: `e2e client ${name} ${suffix}` } });
        result.push({ organization, user, client });
      }
      const [a, b, start] = result;

      // Worker in Org A
      const worker = await tx.user.create({ data: { name: `Hardening Worker A`, email: `hardening-worker-a-${suffix}@example.invalid`, passwordHash, status: 'ACTIVE', role: 'WORKER' } });
      await tx.organizationMember.create({ data: { organizationId: a.organization.id, userId: worker.id, role: 'WORKER' } });

      // Offer A (Accepted permanent portal)
      const offer = await tx.offer.create({ data: { organizationId: a.organization.id, clientId: a.client.id, title: 'Hardening permanent portal', status: 'ACCEPTED', publishedAt: new Date(), acceptedAt: new Date(), createdByUserId: a.user.id } });
      const credential = preparePortalCredential(offer);
      await tx.offer.update({ where: { id: offer.id }, data: { publicTokenHash: credential.hash, publicTokenEncrypted: credential.encrypted } });
      const order = await tx.crmOrder.create({ data: { organizationId: a.organization.id, offerId: offer.id, clientId: a.client.id, title: offer.title, orderNumber: `E2E-${suffix}` } });
      await tx.crmRealization.create({ data: { organizationId: a.organization.id, crmOrderId: order.id, status: 'WAITING_FOR_PRODUCTION' } });

      // Navigation Offer A (Phase 1, unpriced location selection)
      const navOffer = await tx.offer.create({
        data: {
          organizationId: a.organization.id,
          clientId: a.client.id,
          title: `Navigační kampaň E2E ${suffix}`,
          campaignName: `Navigace Ostrava ${suffix}`,
          offerType: 'NAVIGATION',
          status: 'SENT',
          publishedAt: new Date(),
          sentAt: new Date(),
          createdByUserId: a.user.id,
          navigationOffer: {
            create: {
              organizationId: a.organization.id,
              city: 'Ostrava',
              targetName: 'E2E Navigační Cíl',
              targetAddress: 'Nádražní 10, Ostrava',
              targetLatitude: 49.835,
              targetLongitude: 18.292,
              proposalMode: 'LOCATION_SELECTION',
              points: {
                create: [
                  {
                    organizationId: a.organization.id,
                    label: 'Bod 1 – Křižovatka Nádražní',
                    address: 'Nádražní 10, Ostrava',
                    latitude: 49.835,
                    longitude: 18.292,
                    navigationType: 'Směrová tabule',
                    quantity: 1,
                    unitPrice: 0,
                    subtotal: 0,
                    isSelectedByClient: true,
                    sortOrder: 0,
                  },
                  {
                    organizationId: a.organization.id,
                    label: 'Bod 2 – Vjezd z ulice 28. října',
                    address: '28. října 50, Ostrava',
                    latitude: 49.831,
                    longitude: 18.288,
                    navigationType: 'Směrová tabule',
                    quantity: 1,
                    unitPrice: 0,
                    subtotal: 0,
                    isSelectedByClient: true,
                    sortOrder: 1,
                  },
                ],
              },
            },
          },
        },
      });
      const navCred = preparePortalCredential(navOffer);
      await tx.offer.update({ where: { id: navOffer.id }, data: { publicTokenHash: navCred.hash, publicTokenEncrypted: navCred.encrypted } });

      // Standard Media Carrier & Surface
      const carrier = await tx.advertisingCarrier.create({
        data: {
          organizationId: a.organization.id,
          code: `E2E-C-${suffix}`,
          name: `E2E Carrier ${suffix}`,
          type: 'BILLBOARD',
          city: 'Ostrava',
          status: 'ACTIVE',
        },
      });
      const surface = await tx.advertisingSurface.create({
        data: {
          organizationId: a.organization.id,
          carrierId: carrier.id,
          name: 'Plocha A',
          mediaType: 'BILLBOARD',
          status: 'AVAILABLE',
        },
      });

      // Standard Media Offer
      const stdOffer = await tx.offer.create({
        data: {
          organizationId: a.organization.id,
          clientId: a.client.id,
          title: `Standardní nabídka E2E ${suffix}`,
          campaignName: `Kampaň Billboardy ${suffix}`,
          offerType: 'STANDARD_MEDIA',
          status: 'SENT',
          publishedAt: new Date(),
          sentAt: new Date(),
          createdByUserId: a.user.id,
          items: {
            create: [
              {
                organizationId: a.organization.id,
                surfaceId: surface.id,
                dateFrom: new Date('2026-11-01T00:00:00.000Z'),
                dateTo: new Date('2026-11-30T00:00:00.000Z'),
                price: 15000,
                unitPrice: 15000,
                quantity: 1,
                subtotal: 15000,
                sortOrder: 0,
              },
            ],
          },
        },
      });
      const stdCred = preparePortalCredential(stdOffer);
      await tx.offer.update({ where: { id: stdOffer.id }, data: { publicTokenHash: stdCred.hash, publicTokenEncrypted: stdCred.encrypted } });

      return {
        result,
        worker,
        token: credential.token,
        offerId: offer.id,
        navToken: navCred.token,
        navOfferId: navOffer.id,
        stdToken: stdCred.token,
        stdOfferId: stdOffer.id,
        surfaceId: surface.id,
      };
    }, { timeout: 60000 });

    const [a, b, start] = fixtures.result;
    const envVars = {
      E2E_BASE_URL: process.env.E2E_BASE_URL || 'http://localhost:3100',
      E2E_ALLOW_TEST_TENANT: 'true',
      E2E_EMAIL: a.user.email,
      E2E_PASSWORD: password,
      E2E_WORKER_EMAIL: fixtures.worker.email,
      E2E_WORKER_PASSWORD: password,
      E2E_START_EMAIL: start.user.email,
      E2E_START_PASSWORD: password,
      E2E_OWN_CLIENT_ID: a.client.id,
      E2E_FOREIGN_CLIENT_ID: b.client.id,
      E2E_PORTAL_TOKEN: fixtures.token,
      E2E_OFFER_ID: fixtures.offerId,
      E2E_NAV_PORTAL_TOKEN: fixtures.navToken,
      E2E_NAV_OFFER_ID: fixtures.navOfferId,
      E2E_STD_PORTAL_TOKEN: fixtures.stdToken,
      E2E_STD_OFFER_ID: fixtures.stdOfferId,
      E2E_SURFACE_ID: fixtures.surfaceId,
      E2E_ORG_A_ID: a.organization.id,
      E2E_ORG_B_ID: b.organization.id,
      E2E_USER_A_ID: a.user.id,
    };
    writeFileSync('.env.e2e.local', Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
    console.log('Seeded fixtures and wrote .env.e2e.local successfully.');
  } finally {
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Fixture setup failed'); process.exitCode = 1; });
