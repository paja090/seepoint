import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { hashToken, newToken } from '../lib/auth-crypto';

test('Navigation 5+3 points: manager approval, mobile photo installation, one of eight done', async ({ browser }) => {
  test.setTimeout(360000);
  if (process.env.FIELD_PLANNER_TEST_DATABASE !== 'codex-field-planner-20260914' || !new URL(process.env.DATABASE_URL!).hostname.startsWith('ep-fancy-grass-atulv9uv')) throw new Error('Disposable Field Planner database required.');
  const db = new PrismaClient(); const suffix = randomUUID(); const date = new Date().toISOString().slice(0, 10);
  const org = await db.organization.create({ data: { name: 'Planner browser fixture', slug: `fp-browser-${suffix}`, plan: 'PRO' } });
  const otherOrg = await db.organization.create({ data: { name: 'Other browser fixture', slug: `fp-browser-other-${suffix}`, plan: 'PRO' } });
  const manager = await db.user.create({ data: { name: 'Manager fixture', email: `manager-${suffix}@example.invalid`, status: 'ACTIVE', role: 'MANAGER' } });
  const worker = await db.user.create({ data: { name: 'Worker fixture', email: `worker-${suffix}@example.invalid`, status: 'ACTIVE', role: 'WORKER' } });
  await db.organizationMember.createMany({ data: [{ organizationId: org.id, userId: manager.id, role: 'MANAGER' }, { organizationId: org.id, userId: worker.id, role: 'WORKER' }, { organizationId: otherOrg.id, userId: manager.id, role: 'MANAGER' }] });
  await db.employee.create({ data: { organizationId: org.id, firstName: 'Worker', lastName: 'fixture', userId: worker.id, role: 'WORKER' } });
  await db.vehicle.create({ data: { organizationId: org.id, name: 'Test van' } });
  await db.organizationFieldPlanningProfile.create({ data: { organizationId: org.id, configuration: {
    timezone: 'UTC', country: 'SK', depot: { latitude: 48.1, longitude: 17.1 }, endLocation: { latitude: 48.1, longitude: 17.1 }, workdayStart: '00:01', workdayEnd: '23:59', breakMinutes: 0, overtimeMinutes: 0, strategy: 'BALANCED', serviceMinutes: { NAVIGATION_INSTALLATION: 5 }, fallbackSpeedKph: 40, fallbackDistanceFactor: 1.3, maximumJobsPerRoute: 20, vehicleRequired: true, requireHumanApproval: true, enabled: true,
  } } });
  for (const [name, count] of [['Client A', 5], ['Client B', 3]] as const) {
    const client = await db.client.create({ data: { organizationId: org.id, name, normalizedName: name + suffix } });
    const crm = await db.crmOrder.create({ data: { organizationId: org.id, clientId: client.id, title: name, orderNumber: name + suffix } });
    await db.navigationOrder.create({ data: { organizationId: org.id, crmOrderId: crm.id, targetName: name, targetLatitude: 48.1, targetLongitude: 17.1, status: 'PRIPRAVENO_K_INSTALACI',
      points: { create: Array.from({ length: count }, (_, i) => ({ organizationId: org.id, label: name + ' bod ' + (i + 1), address: 'Test city', latitude: 48.1 + i / 10000, longitude: 17.1, navigationType: 'SIGN', sortOrder: i })) } } });
  }
  async function session(userId: string, organizationId: string) {
    const token = newToken(); await db.userSession.create({ data: { userId, activeOrganizationId: organizationId, tokenHash: hashToken(token), sessionVersion: 1, expiresAt: new Date(Date.now() + 3600000) } }); return token;
  }
  const base = 'http://127.0.0.1:3107';
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await context.addCookies([{ name: 'seepoint_session', value: await session(manager.id, org.id), url: base }]);
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/work/route`); await expect(page.getByRole('heading', { name: 'AI Route & Field Planner' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vygenerovat plán' })).toBeEnabled({ timeout: 60000 });
  const generation = page.waitForResponse(r => r.url().endsWith('/api/work/route') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Vygenerovat plán' }).click(); const response = await generation;
  expect(response.ok(), await response.text()).toBeTruthy(); const plan = await response.json();
  await expect(page.locator('strong').filter({ hasText: /^v1 · DRAFT$/ })).toBeVisible();
  expect(plan.result.crews[0].stops).toHaveLength(8); expect(await db.advertisingCarrier.count({ where: { organizationId: org.id } })).toBe(0);
  await page.screenshot({ path: 'output/navigation-planner-desktop.png', fullPage: true });
  const accept = page.getByRole('checkbox', { name: 'Ověřil/a jsem odhadované přejezdy a souhlasím s jejich použitím.' }); if (await accept.count()) await accept.check();
  const approval = page.waitForResponse(r => r.url().endsWith('/api/work/route') && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Schválit plán' }).click(); const approved = await approval; expect(approved.ok(), await approved.text()).toBeTruthy();
  await page.reload(); await expect(page.locator('strong').filter({ hasText: /^v1 · APPROVED$/ })).toBeVisible();
  const workerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await workerContext.addCookies([{ name: 'seepoint_session', value: await session(worker.id, org.id), url: base }]);
  const mobile = await workerContext.newPage(); mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(`${base}/my-route`); await expect(mobile.getByRole('heading', { name: 'Moje trasa dnes' })).toBeVisible();
  await expect(mobile.getByRole('link', { name: 'Navigovat ↗', exact: true })).toHaveCount(8);
  await mobile.screenshot({ path: 'output/navigation-planner-mobile.png', fullPage: true });
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  const start = mobile.waitForResponse(r => r.url().endsWith('/api/work/route/mine') && r.request().method() === 'POST');
  await mobile.getByRole('button', { name: 'Zahájit', exact: true }).first().click(); const started = await start; expect(started.ok(), await started.text()).toBeTruthy();
  await expect(mobile.getByRole('button', { name: 'Dokončit', exact: true })).toHaveCount(1, { timeout: 30000 });
  const card = mobile.locator('article').first();
  await card.getByText('Fotografie a dokončení práce', { exact: true }).click();
  await card.locator('input[name="afterPhoto"]').setInputFiles({ name: 'installation.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64') });
  const upload = mobile.waitForResponse(r => r.url().endsWith('/api/work/route/mine/photo'));
  await card.getByRole('button', { name: 'Uložit fotografii a dokončit bod' }).click();
  const photoResponse = await upload; expect(photoResponse.ok(), await photoResponse.text()).toBeTruthy();
  await expect(mobile.getByText('Test van · 1/8 hotovo', { exact: true })).toBeVisible({ timeout: 30000 });
  expect(await db.navigationPoint.count({ where: { organizationId: org.id, status: 'INSTALLED' } })).toBe(1);
  expect(await db.advertisingCarrier.count({ where: { organizationId: org.id } })).toBe(1);
  expect(await db.workOrder.count({ where: { organizationId: org.id } })).toBe(0);
  await mobile.screenshot({ path: 'output/navigation-planner-mobile-done.png', fullPage: true });
  const forbidden = await workerContext.request.patch(`${base}/api/work/route`, { data: { action: 'approve', id: plan.id } }); expect(forbidden.status()).toBe(403);
  await context.addCookies([{ name: 'seepoint_session', value: await session(manager.id, otherOrg.id), url: base }]);
  expect((await context.request.get(`${base}/api/work/route?id=${plan.id}`)).status()).toBe(404);
  await db.organization.update({ where: { id: otherOrg.id }, data: { enabledModules: { workRoute: false } } });
  expect((await context.request.post(`${base}/api/work/route`, { data: { date, requestKey: randomUUID() } })).status()).toBe(403);
  expect(errors).toEqual([]);
  await context.close(); await workerContext.close(); await db.$disconnect();
});
