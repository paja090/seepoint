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
        const client = await tx.client.create({ data: { organizationId: organization.id, name: `E2E Client ${name}`, normalizedName: `e2e client ${name}` } });
        result.push({ organization, user, client });
      }
      const first = result[0];
      const offer = await tx.offer.create({ data: { organizationId: first.organization.id, clientId: first.client.id, title: 'Hardening permanent portal', status: 'ACCEPTED', publishedAt: new Date(), acceptedAt: new Date() } });
      const credential = preparePortalCredential(offer);
      await tx.offer.update({ where: { id: offer.id }, data: { publicTokenHash: credential.hash, publicTokenEncrypted: credential.encrypted } });
      const order = await tx.crmOrder.create({ data: { organizationId: first.organization.id, offerId: offer.id, clientId: first.client.id, title: offer.title, orderNumber: `E2E-${suffix}` } });
      await tx.crmRealization.create({ data: { organizationId: first.organization.id, crmOrderId: order.id, status: 'WAITING_FOR_PRODUCTION' } });
      return { result, token: credential.token, offerId: offer.id };
    }, { timeout: 60000 });
    const [a,b,start] = fixtures.result;
    writeFileSync('.env.e2e.local', Object.entries({ E2E_BASE_URL: 'http://localhost:3100', E2E_ALLOW_TEST_TENANT: 'true', E2E_EMAIL: a.user.email, E2E_PASSWORD: password, E2E_START_EMAIL: start.user.email, E2E_START_PASSWORD: password, E2E_OWN_CLIENT_ID: a.client.id, E2E_FOREIGN_CLIENT_ID: b.client.id, E2E_PORTAL_TOKEN: fixtures.token, E2E_OFFER_ID: fixtures.offerId, E2E_ORG_A_ID: a.organization.id, E2E_ORG_B_ID: b.organization.id, E2E_USER_A_ID: a.user.id }).map(([key,value]) => `${key}=${value}`).join('\n')+'\n');
    console.log('Created 3 disposable organizations; credentials stored only in ignored .env.e2e.local.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Fixture setup failed'); process.exitCode = 1; });
