import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { POST } from '../app/api/webhooks/resend/route.ts';
import { platformPrisma, prisma } from '../lib/db.ts';
import { getTenantContext, requireTenantContext } from '../lib/tenant-context.ts';
import { tenantPrismaExtension } from '../lib/tenant-prisma.ts';

const secret = Buffer.from('test-only-resend-webhook-secret');

function signedRequest(type: string, data: Record<string, unknown>) {
  const body = JSON.stringify({ type, data });
  const id = 'msg-test-webhook';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64');
  return new Request('https://example.test/api/webhooks/resend', {
    method: 'POST', body,
    headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` },
  });
}

test('signed Resend callbacks execute lazy Prisma mutations inside the resolved tenant', async (t) => {
  const previousSecret = process.env.RESEND_WEBHOOK_SECRET;
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${secret.toString('base64')}`;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = previousSecret;
  });

  const mutations: Array<{ model: string; organizationId: string; args: Record<string, unknown> }> = [];
  // Keep actual PrismaPromise laziness and the production isolation extension.
  // Only the final database operation is intercepted; no database is contacted.
  const client = new PrismaClient({ datasourceUrl: 'postgresql://test:test@localhost:5432/test' });
  t.after(() => client.$disconnect());
  const guarded = client.$extends(tenantPrismaExtension).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, args }) {
          const { organizationId } = requireTenantContext();
          mutations.push({ model, organizationId, args: args as Record<string, unknown> });
          return {} as never;
        },
      },
    },
  }) as unknown as PrismaClient;

  const originalEmailUpdate = prisma.emailLog.update;
  const originalDomainUpdate = prisma.organizationEmailSettings.update;
  const originalEmailLookup = platformPrisma.emailLog.findUnique;
  const originalDomainLookup = platformPrisma.organizationEmailSettings.findFirst;
  t.after(() => {
    prisma.emailLog.update = originalEmailUpdate;
    prisma.organizationEmailSettings.update = originalDomainUpdate;
    platformPrisma.emailLog.findUnique = originalEmailLookup;
    platformPrisma.organizationEmailSettings.findFirst = originalDomainLookup;
  });
  prisma.emailLog.update = ((args) => guarded.emailLog.update(args)) as typeof prisma.emailLog.update;
  prisma.organizationEmailSettings.update = ((args) => guarded.organizationEmailSettings.update(args)) as typeof prisma.organizationEmailSettings.update;
  let emailLookups = 0;
  platformPrisma.emailLog.findUnique = (async ({ where }) => {
    emailLookups++;
    assert.equal(getTenantContext(), null, 'provider lookup must not require a user session');
    if (where.providerMessageId === 'unknown') return null;
    return { id: `log-${where.providerMessageId}`, organizationId: `org-${where.providerMessageId}`, status: 'SENT', metadata: null };
  }) as typeof platformPrisma.emailLog.findUnique;
  platformPrisma.organizationEmailSettings.findFirst = (async (args) => {
    const where = args?.where;
    assert.equal(getTenantContext(), null);
    return { id: `settings-${where?.providerDomainId}`, organizationId: `org-${where?.providerDomainId}`, status: 'PENDING' };
  }) as typeof platformPrisma.organizationEmailSettings.findFirst;

  await t.test('concurrent delivery and domain updates remain scoped to their owners', async () => {
    const responses = await Promise.all([
      POST(signedRequest('email.delivered', { email_id: 'a', organizationId: 'org-attacker' })),
      POST(signedRequest('email.bounced', { email_id: 'b', bounce: { message: 'Mailbox unavailable' } })),
      POST(signedRequest('domain.updated', { id: 'c', status: 'verified', organizationId: 'org-attacker' })),
    ]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
    assert.equal(mutations.length, 3);
    for (const mutation of mutations) {
      assert.equal((mutation.args.where as { organizationId: string }).organizationId, mutation.organizationId);
    }
    const delivered = mutations.find((mutation) => mutation.organizationId === 'org-a')!;
    assert.equal(delivered.model, 'EmailLog');
    assert.equal((delivered.args.data as { status: string }).status, 'DELIVERED');
    assert.ok((delivered.args.data as { deliveredAt: Date }).deliveredAt instanceof Date);
    const bounced = mutations.find((mutation) => mutation.organizationId === 'org-b')!;
    assert.equal((bounced.args.data as { status: string }).status, 'BOUNCED');
    const domain = mutations.find((mutation) => mutation.organizationId === 'org-c')!;
    assert.equal(domain.model, 'OrganizationEmailSettings');
    assert.equal((domain.args.data as { status: string }).status, 'VERIFIED');
    assert.ok((domain.args.data as { lastVerifiedAt: Date }).lastVerifiedAt instanceof Date);
    assert.equal(getTenantContext(), null, 'tenant context must not leak out of the webhook');
  });

  await t.test('unknown provider IDs cause no mutation', async () => {
    const before = mutations.length;
    const response = await POST(signedRequest('email.delivered', { email_id: 'unknown' }));
    assert.equal(response.status, 200);
    assert.equal(mutations.length, before);
  });

  await t.test('invalid signatures are rejected before ownership lookup', async () => {
    const before = emailLookups;
    const request = signedRequest('email.delivered', { email_id: 'a' });
    request.headers.set('svix-signature', 'v1,invalid');
    const response = await POST(request);
    assert.equal(response.status, 401);
    assert.equal(emailLookups, before);
  });
});
