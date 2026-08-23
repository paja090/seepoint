const baseUrl = process.env.CODEX_PREVIEW_BASE_URL;
const email = process.env.CODEX_PREVIEW_EMAIL || process.env.SEED_ADMIN_EMAIL;
const password = process.env.CODEX_PREVIEW_PASSWORD || process.env.SEED_ADMIN_PASSWORD;

if (!baseUrl?.endsWith('.vercel.app') || !email || !password) throw new Error('Preview URL and administrator credentials are required.');

const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
if (!login.ok) throw new Error(`Preview login failed with ${login.status}.`);
const setCookies = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : [login.headers.get('set-cookie')].filter(Boolean);
const cookie = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
const request = (path, init = {}) => fetch(`${baseUrl}${path}`, { ...init, headers: { cookie, ...(init.headers ?? {}) } });
const switchTo = (organizationId) => request('/api/auth/switch-organization', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId }) });
const progressFrom = (html) => {
  const match = html.match(/(\d) z 5 kroků[^0-9]+(\d+) %/);
  return match ? { completedCount: Number(match[1]), percent: Number(match[2]) } : null;
};

const organizationsResponse = await request('/api/admin/organizations');
const organizations = await organizationsResponse.json();
const agency = organizations.find((organization) => organization.slug === 'agentura-b-test');
const seePoint = organizations.find((organization) => organization.slug === 'seepoint');
if (!agency || !seePoint) throw new Error('Required preview organizations were not found.');

if (!(await switchTo(seePoint.id)).ok) throw new Error('Could not switch to SeePoint.');
const seePointBefore = progressFrom(await (await request('/onboarding')).text());

if (!(await switchTo(agency.id)).ok) throw new Error('Could not switch to Agentura B.');
const agencyPage = await request('/onboarding');
const agencyHtml = await agencyPage.text();
const maliciousPatch = await request('/api/onboarding', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ step: 'SETTINGS', organizationId: seePoint.id }),
});
const agencyProgress = await maliciousPatch.json();

if (!(await switchTo(seePoint.id)).ok) throw new Error('Could not switch back to SeePoint.');
const seePointAfter = progressFrom(await (await request('/onboarding')).text());
const unauthenticatedPatch = await fetch(`${baseUrl}/api/onboarding`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ step: 'TEAM' }) });

const result = {
  pageStatus: agencyPage.status,
  activeOrganizationRendered: agencyHtml.includes('Agentura B'),
  patchStatus: maliciousPatch.status,
  patchAppliedToSessionTenant: agencyProgress?.ok === true,
  foreignOrganizationUnchanged: JSON.stringify(seePointBefore) === JSON.stringify(seePointAfter),
  unauthenticatedPatch: unauthenticatedPatch.status,
};
console.log(JSON.stringify(result, null, 2));
if (result.pageStatus !== 200 || !result.activeOrganizationRendered || result.patchStatus !== 200 || !result.patchAppliedToSessionTenant || !result.foreignOrganizationUnchanged || result.unauthenticatedPatch !== 403) process.exitCode = 1;
