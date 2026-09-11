import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getSystemNotifications,
  ALL_NOTIFICATION_PROVIDERS,
  type NotificationProvider,
  type NotificationContext,
} from '../lib/notifications-service.ts';
import { runWithTenantContext, TenantContextError } from '../lib/tenant-context.ts';

const source = (relPath: string) => readFileSync(new URL(`../${relPath}`, import.meta.url), 'utf8');

test('getSystemNotifications throws TenantContextError when called without tenant context and no organizationId', async () => {
  await assert.rejects(
    () => getSystemNotifications('ADMIN', 'user-1'),
    (err: unknown) => {
      assert.ok(err instanceof TenantContextError);
      assert.match((err as Error).message, /Tenant context is required/);
      return true;
    },
  );
});

test('getSystemNotifications propagates tenant context to all active providers', async () => {
  const capturedContexts: NotificationContext[] = [];

  const testProvider: NotificationProvider = {
    name: 'test-capture',
    shouldRun: () => true,
    async getNotifications(ctx) {
      capturedContexts.push(ctx);
      return [
        {
          id: `test-${ctx.organizationId}`,
          type: 'OVERDUE_TASK',
          title: `Task for ${ctx.organizationId}`,
          message: 'Test message',
          severity: 'HIGH',
          link: '/test',
          createdAt: ctx.now.toISOString(),
        },
      ];
    },
  };

  const resultOrgA = await runWithTenantContext({ organizationId: 'org_alpha', source: 'test' }, () =>
    getSystemNotifications('ADMIN', 'user-a', { providers: [testProvider] }),
  );

  const resultOrgB = await runWithTenantContext({ organizationId: 'org_beta', source: 'test' }, () =>
    getSystemNotifications('ADMIN', 'user-b', { providers: [testProvider] }),
  );

  assert.equal(capturedContexts.length, 2);
  assert.equal(capturedContexts[0].organizationId, 'org_alpha');
  assert.equal(capturedContexts[1].organizationId, 'org_beta');

  // Tenant A never sees Tenant B notifications
  assert.equal(resultOrgA.notifications[0].id, 'test-org_alpha');
  assert.equal(resultOrgB.notifications[0].id, 'test-org_beta');
  assert.notEqual(resultOrgA.notifications[0].id, resultOrgB.notifications[0].id);
});

test('failure of one non-critical provider does not crash getSystemNotifications and other providers succeed', async () => {
  const healthyProvider: NotificationProvider = {
    name: 'healthy-provider',
    shouldRun: () => true,
    async getNotifications(ctx) {
      return [
        {
          id: 'healthy-1',
          type: 'EXPIRING_CONTRACT',
          title: 'Smlouva OK',
          message: 'Detail smlouvy',
          severity: 'HIGH',
          link: '/contracts',
          createdAt: ctx.now.toISOString(),
        },
      ];
    },
  };

  const failingProvider: NotificationProvider = {
    name: 'failing-warehouse',
    shouldRun: () => true,
    async getNotifications() {
      throw new Error('Simulated database timeout in warehouseItem.findMany');
    },
  };

  const result = await runWithTenantContext({ organizationId: 'org_test', source: 'test' }, () =>
    getSystemNotifications('ADMIN', 'user-1', {
      providers: [healthyProvider, failingProvider],
    }),
  );

  assert.equal(result.totalCount, 1);
  assert.equal(result.notifications[0].id, 'healthy-1');
  assert.ok(result.providerErrors);
  assert.equal(result.providerErrors?.length, 1);
  assert.equal(result.providerErrors?.[0].provider, 'failing-warehouse');
  assert.match(result.providerErrors?.[0].error ?? '', /Simulated database timeout/);
});

test('critical security error (TenantContextError) inside a provider is never swallowed', async () => {
  const criticalFailingProvider: NotificationProvider = {
    name: 'critical-breach-provider',
    shouldRun: () => true,
    async getNotifications() {
      throw new TenantContextError('Critical tenant isolation failure');
    },
  };

  await assert.rejects(
    () =>
      runWithTenantContext({ organizationId: 'org_test', source: 'test' }, () =>
        getSystemNotifications('ADMIN', 'user-1', {
          providers: [criticalFailingProvider],
        }),
      ),
    (err: unknown) => {
      assert.ok(err instanceof TenantContextError);
      assert.match((err as Error).message, /Critical tenant isolation failure/);
      return true;
    },
  );
});

test('all required providers are registered in ALL_NOTIFICATION_PROVIDERS', () => {
  const providerNames = ALL_NOTIFICATION_PROVIDERS.map((p) => p.name);
  assert.ok(providerNames.includes('personal-tasks'), 'personal-tasks provider must exist');
  assert.ok(providerNames.includes('navigation-contracts'), 'navigation-contracts provider must exist');
  assert.ok(providerNames.includes('radar-opportunities'), 'radar-opportunities provider must exist');
  assert.ok(providerNames.includes('production-print-jobs'), 'production-print-jobs provider must exist');
  assert.ok(providerNames.includes('work-orders'), 'work-orders provider must exist');
  assert.ok(providerNames.includes('warehouse-stock'), 'warehouse-stock provider must exist');
  assert.ok(providerNames.includes('city-gallery-permits'), 'city-gallery-permits provider must exist');
  assert.ok(providerNames.includes('vehicles'), 'vehicles provider must exist');
});

test('route /api/notifications enforces authentication, active organization, and explicit runWithTenantContext', () => {
  const routeSrc = source('app/api/notifications/route.ts');
  assert.match(routeSrc, /getCurrentUser\(\)/);
  assert.match(routeSrc, /if\s*\(!user\)[\s\S]*?401/);
  assert.match(routeSrc, /if\s*\(!user\.organizationId\)[\s\S]*?403/);
  assert.match(routeSrc, /enterTenantContext\(tenantContext\)/);
  assert.match(routeSrc, /runWithTenantContext\(tenantContext/);
  assert.match(routeSrc, /TenantContextError/);
});

test('route /api/notifications/unread enforces authentication, active organization, and explicit runWithTenantContext', () => {
  const unreadSrc = source('app/api/notifications/unread/route.ts');
  assert.match(unreadSrc, /getCurrentUser\(\)/);
  assert.match(unreadSrc, /if\s*\(!user\)[\s\S]*?401/);
  assert.match(unreadSrc, /if\s*\(!user\.organizationId\)[\s\S]*?403/);
  assert.match(unreadSrc, /enterTenantContext\(tenantContext\)/);
  assert.match(unreadSrc, /runWithTenantContext\(tenantContext/);
  assert.match(unreadSrc, /TenantContextError/);
});

test('NotificationBellCenter coordinates polling across multiple mounted instances with single timer and 401 guard', () => {
  const bellSrc = source('components/notifications/NotificationBellCenter.tsx');
  assert.match(bellSrc, /pollingTimer/);
  assert.match(bellSrc, /subscribers/);
  assert.match(bellSrc, /res\.status === 401/);
  assert.match(bellSrc, /isUnauthenticated\s*=\s*true/);
  assert.match(bellSrc, /stopPolling\(\)/);
  assert.match(bellSrc, /visibilitychange/);
});
