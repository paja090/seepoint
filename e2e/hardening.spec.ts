import { test, expect, type Page } from '@playwright/test';

const base = process.env.E2E_BASE_URL;
test.beforeEach(() => {
  if (!base || process.env.E2E_ALLOW_TEST_TENANT !== 'true') throw new Error('Configure E2E_BASE_URL and explicit disposable-tenant authorization.');
  const hostname = new URL(base).hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.vercel.app')) throw new Error('E2E requires local or isolated Vercel preview.');
});
async function login(page: Page, prefix: 'E2E' | 'E2E_START') {
  const email = process.env[`${prefix}_EMAIL`]; const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing ${prefix} test credentials.`);
  const response = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(response.ok()).toBeTruthy();
}
test('START denies direct Warehouse page and API', async ({ page }) => {
  await login(page, 'E2E_START');
  const response = await page.request.get('/api/warehouse/items');
  expect(response.status()).toBe(403);
  const mutation = await page.request.post('/api/warehouse/items', { data: { name: 'must-not-be-created' } });
  expect(mutation.status()).toBe(403);
  await page.goto('/warehouse');
  await expect(page).toHaveURL(/\/module-unavailable$/);
});
test('organization A cannot read client B while own client remains accessible', async ({ page }) => {
  await login(page, 'E2E');
  const own = process.env.E2E_OWN_CLIENT_ID; const foreign = process.env.E2E_FOREIGN_CLIENT_ID;
  if (!own || !foreign || own === foreign) throw new Error('Two tenant-owned client fixtures required.');
  expect((await page.request.get(`/api/crm/clients/${own}`)).status()).toBe(200);
  expect([403, 404]).toContain((await page.request.get(`/api/crm/clients/${foreign}`)).status());
});
test('existing permanent campaign URL renders the portal across reloads', async ({ page }) => {
  const token = process.env.E2E_PORTAL_TOKEN;
  if (!token) throw new Error('A published accepted/converted disposable offer token is required.');
  const response = await page.goto(`/offer/${token}`);
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText('Kampaň nebyla nalezena')).toHaveCount(0);
  await expect(page.getByText('Nabídka nebyla nalezena')).toHaveCount(0);
  await expect(page.getByText('Odhadovaný zásah není pro tuto kampaň dostupný.')).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/offer/${token}$`));
});
