const baseUrl = process.env.CODEX_PREVIEW_BASE_URL;
const email = process.env.CODEX_PREVIEW_EMAIL;
const password = process.env.CODEX_PREVIEW_PASSWORD;
const foreignClientId = process.env.CODEX_FOREIGN_CLIENT_ID;
const ownClientId = process.env.CODEX_OWN_CLIENT_ID;

if (!baseUrl?.endsWith('.vercel.app') || !email || !password || !foreignClientId || !ownClientId) {
  throw new Error('Preview URL, credentials and both client IDs are required.');
}

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`Preview login failed with ${login.status}.`);
const setCookies = typeof login.headers.getSetCookie === 'function'
  ? login.headers.getSetCookie()
  : [login.headers.get('set-cookie')].filter(Boolean);
const cookie = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
if (!cookie) throw new Error('Preview login did not return a session cookie.');

const request = (path, init = {}) => fetch(`${baseUrl}${path}`, {
  ...init,
  headers: { cookie, ...(init.headers ?? {}) },
});

const organizationsResponse = await request('/api/admin/organizations');
if (!organizationsResponse.ok) throw new Error(`Organization listing failed with ${organizationsResponse.status}.`);
const organizations = await organizationsResponse.json();
const agencyB = organizations.find((organization) => organization.slug === 'agentura-b-test');
if (!agencyB) throw new Error('Agentura B was not found through the SUPER_ADMIN API.');

const switchResponse = await request('/api/auth/switch-organization', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ organizationId: agencyB.id }),
});
if (!switchResponse.ok) throw new Error(`Organization switch failed with ${switchResponse.status}.`);

const carriersBeforeResponse = await request('/api/carriers?pageSize=100');
const carriersBeforeBody = await carriersBeforeResponse.json();
let testCarrier = carriersBeforeBody.carriers?.find((carrier) => carrier.code === 'TENANT-B-E2E-001');
if (!testCarrier) {
  const createCarrierResponse = await request('/api/carriers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Agentura B testovací nosič',
      code: 'TENANT-B-E2E-001',
      type: 'CITY_POSTER',
      city: 'Ostrava',
      latitude: 49.8209,
      longitude: 18.2625,
      surfaceTemplates: [{ name: 'B – testovací plocha', mediaType: 'CITY_POSTER', orientation: 'A' }],
    }),
  });
  if (!createCarrierResponse.ok) throw new Error(`Test carrier creation failed with ${createCarrierResponse.status}.`);
  testCarrier = await createCarrierResponse.json();
}
const ownSurfaceIds = (testCarrier.surfaces ?? []).map((surface) => surface.id);
if (ownSurfaceIds.length !== 1) throw new Error('Expected exactly one Agentura B test surface.');

const aiPreviewResponse = await request('/api/offers/ai-generate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    action: 'preview',
    offerType: 'STANDARD_MEDIA',
    prompt: 'Jedna city poster plocha v Ostravě',
    clientId: ownClientId,
    city: 'Ostrava',
    mediaType: 'CITY_POSTER',
    quantity: 10,
    dateFrom: '2026-09-01',
    dateTo: '2026-10-01',
  }),
});
const aiPreview = await aiPreviewResponse.json();
const aiSurfaceIds = Array.isArray(aiPreview.items) ? aiPreview.items.map((item) => item.surfaceId) : [];

const offersResponse = await request('/api/offers');
const existingOffers = await offersResponse.json();
let testOffer = Array.isArray(existingOffers) ? existingOffers.find((offer) => offer.clientId === ownClientId) : undefined;
if (!testOffer) {
  const confirmResponse = await request('/api/offers/ai-generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'confirm',
      offerType: 'STANDARD_MEDIA',
      prompt: 'Tenant B E2E izolační nabídka city poster v Ostravě',
      clientId: ownClientId,
      city: 'Ostrava',
      mediaType: 'CITY_POSTER',
      quantity: 1,
      selectedSurfaceIds: ownSurfaceIds,
      isNoPriceConcept: true,
      dateFrom: '2026-09-01',
      dateTo: '2026-10-01',
    }),
  });
  const confirmation = await confirmResponse.json();
  if (!confirmResponse.ok || !confirmation.offerId) throw new Error(`AI test offer creation failed with ${confirmResponse.status}.`);
  testOffer = { id: confirmation.offerId };
}

const orderResponse = await request('/api/crm/orders/convert-from-offer', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ offerId: testOffer.id }),
});
const orderBody = await orderResponse.json();

const opportunitiesResponse = await request('/api/sales/opportunities?search=Agentura%20B%20E2E');
const opportunitiesBody = await opportunitiesResponse.json();
let testOpportunity = opportunitiesBody.opportunities?.[0];
if (!testOpportunity) {
  const opportunityResponse = await request('/api/sales/opportunities', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      companyName: "McDonald's",
      title: 'Agentura B E2E – nová pobočka',
      city: 'Ostrava',
      region: 'Moravskoslezský kraj',
      eventType: 'NEW_BRANCH',
      summary: 'Test tenantové izolace AI obchodních dat.',
      sourceUrl: 'https://example.com/seepoint-tenant-e2e',
      clientId: ownClientId,
      suggestedMediaTypes: ['CITY_POSTER'],
    }),
  });
  const opportunityBody = await opportunityResponse.json();
  if (!opportunityResponse.ok) throw new Error(`Test opportunity creation failed with ${opportunityResponse.status}.`);
  testOpportunity = opportunityBody.opportunity ?? opportunityBody;
}

const [listResponse, ownReadResponse, foreignReadResponse, foreignUpdateResponse, forgedSwitchResponse] = await Promise.all([
  request('/api/crm/clients'),
  request(`/api/crm/clients/${ownClientId}`),
  request(`/api/crm/clients/${foreignClientId}`),
  request(`/api/crm/clients/${foreignClientId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: "McDonald's" }),
  }),
  request('/api/auth/switch-organization', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId: 'org_non_member_forged' }),
  }),
]);

const listBody = await listResponse.json();
const clients = Array.isArray(listBody) ? listBody : Array.isArray(listBody.clients) ? listBody.clients : [];
const result = {
  superAdminOrganizationList: organizationsResponse.status,
  switchedTo: agencyB.slug,
  tenantClientList: {
    status: listResponse.status,
    count: clients.length,
    names: clients.map((client) => client.name),
  },
  ownClientRead: ownReadResponse.status,
  foreignClientRead: foreignReadResponse.status,
  foreignClientUpdate: foreignUpdateResponse.status,
  forgedOrganizationSwitch: forgedSwitchResponse.status,
  inventory: { carrierCode: testCarrier.code, surfaceIds: ownSurfaceIds },
  aiPreview: { status: aiPreviewResponse.status, candidateCount: aiPreview.candidateCount, surfaceIds: aiSurfaceIds },
  offer: { id: testOffer.id },
  crmOrder: { status: orderResponse.status, id: orderBody.order?.id, number: orderBody.order?.orderNumber },
  salesOpportunity: { id: testOpportunity.id, companyName: testOpportunity.companyName },
};

console.log(JSON.stringify(result, null, 2));
if (result.ownClientRead !== 200
  || result.foreignClientRead !== 404
  || result.foreignClientUpdate !== 404
  || result.forgedOrganizationSwitch !== 404
  || clients.some((client) => client.id === foreignClientId)
  || result.aiPreview.status !== 200
  || result.aiPreview.candidateCount !== 1
  || result.aiPreview.surfaceIds.some((id) => !ownSurfaceIds.includes(id))
  || result.crmOrder.status !== 200
  || !result.crmOrder.id
  || !result.salesOpportunity.id) {
  process.exitCode = 1;
}
