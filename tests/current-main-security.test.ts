import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canReuseResendDomain } from '../lib/email-domain-ownership';
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
  assert.match(source('lib/resend-service.ts'), /canReuseResendDomain\(existing.id, ownedProviderDomainId/);
  assert.match(source('app/api/settings/email/connect/route.ts'), /ownedSettings\?\.domain === cleanDomain/);
  const schema = source('prisma/schema.prisma');
  assert.match(schema, /domain\s+String\s+@unique/);
  assert.match(schema, /providerDomainId\s+String\?\s+@unique/);
});

test('radar notifications honor disabled SaaS module', () => {
  assert.match(source('app/api/notifications/unread/route.ts'), /hasModuleAccess\(user, 'salesRadar'\)/);
  assert.match(source('lib/notifications-service.ts'), /enabled\('salesRadar'\) \? await prisma.salesOpportunity/);
});

 test('domain reuse requires existing tenant ownership or separately verified provider credentials', () => {
  assert.equal(canReuseResendDomain('domain-a', undefined, false), false);
  assert.equal(canReuseResendDomain('domain-a', 'domain-b', false), false);
  assert.equal(canReuseResendDomain('domain-a', 'domain-a', false), true);
  assert.equal(canReuseResendDomain('domain-a', undefined, true), true);
  assert.match(source('lib/resend-service.ts'), /if \(!listRes.ok\) throw/);
 });
 test('cron AI logs have nullable real actor and are awaited before request completion', () => {
  const runner = source('lib/opportunities/discovery-runner.ts');
  assert.doesNotMatch(runner, /void logAIUsage|userId: userId \|\| 'cron-runner'/);
  assert.match(runner, /userId: triggerType === 'CRON' \? null : userId/);
  assert.match(runner, /await logAIUsage/);
  assert.match(runner, /usageEstimated: true, costEstimated: true/);
 });

 test('sender editing retains tenant scope and does not expose encrypted sending credentials', () => {
  const route = source('app/api/settings/email/route.ts').split('export async function PATCH')[1];
  assert.ok(route);
  assert.match(route, /requireApiAccess\('settings'\)/);
  assert.match(route, /user.role !== 'ADMIN'/);
  assert.match(route, /organizationId: user.organizationId/);
  assert.match(route, /isValidEmailAddress\(rawFromEmail\)/);
  assert.match(route, /isValidEmailAddress\(rawReplyTo\)/);
  assert.match(route, /omit: \{ encryptedSendingApiKey: true \}/);
 });
