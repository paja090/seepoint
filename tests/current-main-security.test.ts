import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('manual radar cron is restricted to authenticated organization and active entitlement', () => {
  const route = source('app/api/cron/sales-radar/route.ts');
  assert.match(route, /hasModuleAccess\(user, 'salesRadar'\)/);
  assert.match(route, /callerOrganizationId = user.organizationId/);
  assert.match(route, /isCronAuthorized \? \{\} : \{ id: callerOrganizationId \}/);
  assert.match(route, /isModuleEnabled\(org, 'salesRadar'\)/);
  assert.match(route, /runWithTenantContext\(\{ organizationId: org.id/);
});

test('signed email webhook resolves ownership before tenant-scoped mutations', () => {
  const route = source('app/api/webhooks/resend/route.ts');
  assert.ok(route.indexOf('if (!isValid)') < route.indexOf('await platformPrisma.emailLog'));
  assert.match(route, /runWithTenantContext\(\{ organizationId: emailLog.organizationId/);
  assert.match(route, /runWithTenantContext\(\{ organizationId: settings.organizationId/);
  assert.match(route, /if \(!offer\) return/);
  assert.doesNotMatch(route, /platformPrisma\.(?:emailLog|organizationEmailSettings)\.(?:create|update|delete)/);
});

test('already-registered Resend domains cannot be claimed by another organization', () => {
  assert.match(source('lib/resend-service.ts'), /existing && existing.id === ownedProviderDomainId/);
  assert.match(source('app/api/settings/email/connect/route.ts'), /ownedSettings\?\.domain === cleanDomain/);
  const schema = source('prisma/schema.prisma');
  assert.match(schema, /domain\s+String\s+@unique/);
  assert.match(schema, /providerDomainId\s+String\?\s+@unique/);
});

test('radar notifications honor disabled SaaS module', () => {
  assert.match(source('app/api/notifications/unread/route.ts'), /hasModuleAccess\(user, 'salesRadar'\)/);
  assert.match(source('lib/notifications-service.ts'), /enabled\('salesRadar'\) \? await prisma.salesOpportunity/);
});
