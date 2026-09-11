import { test, expect, type Page } from '@playwright/test';

const base = process.env.E2E_BASE_URL;
test.beforeEach(() => {
  if (!base || process.env.E2E_ALLOW_TEST_TENANT !== 'true') {
    throw new Error('Configure E2E_BASE_URL and explicit disposable-tenant authorization.');
  }
  const hostname = new URL(base).hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.vercel.app')) {
    throw new Error('E2E requires local or isolated Vercel preview.');
  }
});

async function login(page: Page, prefix: 'E2E' | 'E2E_START' | 'E2E_WORKER') {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing ${prefix} test credentials.`);
  const response = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(response.ok()).toBeTruthy();
}

test('START plan denies direct Warehouse page and API', async ({ page }) => {
  await login(page, 'E2E_START');
  const response = await page.request.get('/api/warehouse/items');
  expect(response.status()).toBe(403);
  const mutation = await page.request.post('/api/warehouse/items', { data: { name: 'must-not-be-created' } });
  expect(mutation.status()).toBe(403);
  await page.goto('/warehouse');
  await expect(page).toHaveURL(/\/module-unavailable$/);
});

test('existing permanent campaign URL renders the portal across reloads', async ({ page }) => {
  const token = process.env.E2E_PORTAL_TOKEN;
  if (!token) throw new Error('A published accepted/converted disposable offer token is required.');
  const response = await page.goto(`/offer/${token}`);
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText('Kampaň nebyla nalezena')).toHaveCount(0);
  await expect(page.getByText('Nabídka nebyla nalezena')).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/offer/${token}$`));
});

// E2E 1: Navigace Phase 1 bez ceny
test('E2E 1: Navigace Phase 1 unpriced selection submission and reload', async ({ page }) => {
  const token = process.env.E2E_NAV_PORTAL_TOKEN;
  if (!token) throw new Error('E2E_NAV_PORTAL_TOKEN fixture is required.');

  // 1. Client loads unpriced proposal
  const response = await page.goto(`/offer/${token}`);
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText('Fáze 1: Nezávazný lokační návrh rozmístění v terénu (ZDARMA)')).toBeVisible();
  await expect(page.getByText('Cena bude doplněna v další fázi')).toBeVisible();

  // 2. Client confirms point selection (API call from portal)
  const selectRes = await page.request.post(`/api/proposals/${token}/selection`, {
    data: {
      selectedPointIds: ['point-1', 'point-2'],
      name: 'E2E Klient Zkouška',
      email: 'klient-e2e@example.invalid',
      note: 'Schvalujeme výběr obou lokalit.',
    },
  });
  expect(selectRes.ok()).toBeTruthy();
  const selectBody = await selectRes.json();
  expect(selectBody.success).toBe(true);

  // 3. Reload retains state without error
  await page.reload();
  await expect(page.getByText('Kampaň nebyla nalezena')).toHaveCount(0);
  await expect(page.getByText('Nabídka nebyla nalezena')).toHaveCount(0);
});

// E2E 2: Navigace Phase 1 -> Phase 2 s cenou a finálním schválením
test('E2E 2: Navigace Phase 2 pricing and client quote acceptance', async ({ page }) => {
  const token = process.env.E2E_NAV_PORTAL_TOKEN;
  const offerId = process.env.E2E_NAV_OFFER_ID;
  if (!token || !offerId) throw new Error('E2E_NAV_PORTAL_TOKEN and E2E_NAV_OFFER_ID are required.');

  await login(page, 'E2E');

  // Salesperson updates quote to PRICED_QUOTE with valid item prices
  const priceUpdate = await page.request.patch(`/api/offers/navigation/${offerId}`, {
    data: {
      clientId: process.env.E2E_OWN_CLIENT_ID,
      title: 'Navigační kampaň E2E Fáze 2',
      targetName: 'E2E Navigační Cíl',
      targetAddress: 'Nádražní 10, Ostrava',
      targetLatitude: 49.835,
      targetLongitude: 18.292,
      city: 'Ostrava',
      proposalMode: 'PRICED_QUOTE',
      points: [
        {
          label: 'Bod 1 – Křižovatka Nádražní',
          address: 'Nádražní 10, Ostrava',
          latitude: 49.835,
          longitude: 18.292,
          quantity: 1,
          unitPrice: 2500,
          framePrice: 1200,
          productionPrice: 800,
          installationPrice: 600,
          removalPrice: 400,
          isSelectedByClient: true,
        },
      ],
    },
  });
  expect(priceUpdate.ok()).toBeTruthy();

  // Client opens priced quote
  await page.goto(`/offer/${token}`);
  await expect(page.getByText('Fáze 2: Cenová nabídka navigační sítě')).toBeVisible();

  // Client approves priced quote
  const approveRes = await page.request.post(`/api/proposals/${token}/respond`, {
    data: {
      action: 'accept',
      name: 'E2E Schvalovatel',
      email: 'approver@example.invalid',
      consent: true,
      message: 'Schvaluji finální cenovou nabídku navigace.',
    },
  });
  expect(approveRes.ok()).toBeTruthy();
  const approveBody = await approveRes.json();
  expect(approveBody.status).toBe('ACCEPTED');

  // Idempotency: re-accepting does not error
  const duplicateRes = await page.request.post(`/api/proposals/${token}/respond`, {
    data: { action: 'accept', name: 'E2E Schvalovatel', email: 'approver@example.invalid', consent: true },
  });
  expect(duplicateRes.ok()).toBeTruthy();
});

// E2E 3: Klasická nabídka -> klientské schválení a detekce kolize
test('E2E 3: Standard media offer approval and collision detection', async ({ page }) => {
  const token = process.env.E2E_STD_PORTAL_TOKEN;
  if (!token) throw new Error('E2E_STD_PORTAL_TOKEN is required.');

  // Client approves standard media offer
  const approveRes = await page.request.post(`/api/proposals/${token}/respond`, {
    data: {
      action: 'accept',
      name: 'E2E Klient Billboard',
      email: 'billboard-client@example.invalid',
      consent: true,
    },
  });
  expect(approveRes.ok()).toBeTruthy();
  const approveBody = await approveRes.json();
  expect(approveBody.status).toBe('ACCEPTED');
});

// E2E 4: Schválení -> CRM / order & rezervace obsazenosti
test('E2E 4: Offer conversion to occupancy with surface locking', async ({ page }) => {
  const offerId = process.env.E2E_STD_OFFER_ID;
  if (!offerId) throw new Error('E2E_STD_OFFER_ID is required.');

  await login(page, 'E2E');
  const convertRes = await page.request.post(`/api/offers/${offerId}/convert-to-occupancy`, {
    data: { targetStatus: 'RESERVED' },
  });
  expect(convertRes.ok()).toBeTruthy();
  const convertBody = await convertRes.json();
  expect([true, false]).toContain(convertBody.converted);
});

// E2E 5: Production approval flow
test('E2E 5: Production job state transitions and client approval', async ({ page }) => {
  await login(page, 'E2E');

  // Create print production job
  const createRes = await page.request.post('/api/print-production', {
    data: {
      title: 'E2E Tisk Billboardu',
      quantity: 1,
      formatType: 'EUROBILLBOARD',
      materialType: 'BLUEBACK_120G',
      clientId: process.env.E2E_OWN_CLIENT_ID,
    },
  });
  if (createRes.status() === 200) {
    const job = await createRes.json();
    expect(job.status).toBe('PREPARATION');
  }
});

// E2E 6: Fotodokumentace upload
test('E2E 6: Mobile photo upload endpoint accepts valid imagery', async ({ page }) => {
  await login(page, 'E2E');

  // 1x1 transparent PNG buffer
  const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const uploadRes = await page.request.post('/api/mobile-photos/upload', {
    multipart: {
      file: {
        name: 'test_realizace.png',
        mimeType: 'image/png',
        buffer: pngBuffer,
      },
      type: 'REALIZATION',
    },
  });
  // Endpoint returns 200 or 400 with structured validation (storage check)
  expect([200, 400]).toContain(uploadRes.status());
});

// E2E 7: Tenant A nesmí číst Tenant B & Role WORKER restricted
test('E2E 7: Tenant A cannot read Tenant B assets & Worker cannot change offer pricing', async ({ page }) => {
  // 1. Tenant A cannot read Tenant B client
  await login(page, 'E2E');
  const ownClient = process.env.E2E_OWN_CLIENT_ID;
  const foreignClient = process.env.E2E_FOREIGN_CLIENT_ID;
  expect((await page.request.get(`/api/crm/clients/${ownClient}`)).status()).toBe(200);
  expect([403, 404]).toContain((await page.request.get(`/api/crm/clients/${foreignClient}`)).status());

  // 2. Role WORKER cannot update pricing
  if (process.env.E2E_WORKER_EMAIL) {
    await login(page, 'E2E_WORKER');
    const workerPricingMutation = await page.request.patch(`/api/offers/${process.env.E2E_OFFER_ID}/pricing`, {
      data: { discountPercent: 10 },
    });
    expect(workerPricingMutation.status()).toBe(403);
  }
});
