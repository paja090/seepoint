const baseUrl = process.env.CODEX_PREVIEW_BASE_URL;
const email = process.env.CODEX_PREVIEW_EMAIL || process.env.SEED_ADMIN_EMAIL;
const password = process.env.CODEX_PREVIEW_PASSWORD || process.env.SEED_ADMIN_PASSWORD;
const invitedEmail = process.env.CODEX_INVITED_EMAIL || 'subert.pvel+invite-lifecycle@gmail.com';

if (!baseUrl?.endsWith('.vercel.app') || !email || !password) throw new Error('Preview URL and administrator credentials are required.');

const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
if (!login.ok) throw new Error(`Preview login failed with ${login.status}.`);
const setCookies = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : [login.headers.get('set-cookie')].filter(Boolean);
const cookie = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
const request = (path, init = {}) => fetch(`${baseUrl}${path}`, { ...init, headers: { cookie, ...(init.headers ?? {}) } });
const patch = (path, body) => request(path, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const organizationsResponse = await request('/api/admin/organizations');
const organizations = await organizationsResponse.json();
const agency = organizations.find((organization) => organization.slug === 'agentura-b-test');
const seePoint = organizations.find((organization) => organization.slug === 'seepoint');
if (!agency || !seePoint) throw new Error('Required preview organizations were not found.');
const switchTo = (organizationId) => request('/api/auth/switch-organization', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId }) });
if (!(await switchTo(agency.id)).ok) throw new Error('Could not switch to Agentura B.');

const createResponse = await request('/api/organization/invitations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: invitedEmail, role: 'SALES' }) });
const created = await createResponse.json();
if (!createResponse.ok || !created.activationUrl) throw new Error(`Invitation creation failed: ${JSON.stringify(created)}`);

const listInvitations = async () => {
  const response = await request('/api/organization/invitations');
  if (!response.ok) throw new Error(`Invitation listing failed with ${response.status}.`);
  return response.json();
};
const firstList = await listInvitations();
const original = firstList.find((invitation) => invitation.email === invitedEmail);
if (!original) throw new Error('Created invitation is not listed.');

const roleResponse = await patch(`/api/organization/invitations/${original.id}`, { action: 'update-role', role: 'ACCOUNTANT' });
const roleList = await listInvitations();
const roleUpdated = roleList.find((invitation) => invitation.id === original.id)?.role === 'ACCOUNTANT';

const resendResponse = await patch(`/api/organization/invitations/${original.id}`, { action: 'resend' });
const resent = await resendResponse.json();
const resentList = await listInvitations();
const replacement = resentList.find((invitation) => invitation.email === invitedEmail);
if (!resendResponse.ok || !resent.activationUrl || !replacement || replacement.id === original.id) throw new Error(`Invitation resend failed: ${JSON.stringify(resent)}`);

const tokenFrom = (url) => new URL(url).pathname.split('/').filter(Boolean).at(-1);
const tryActivation = (token) => fetch(`${baseUrl}/api/auth/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, purpose: 'activation', password: 'LifecycleTest2026!', passwordConfirmation: 'LifecycleTest2026!' }) });
const oldTokenResponse = await tryActivation(tokenFrom(created.activationUrl));

const revokeResponse = await patch(`/api/organization/invitations/${replacement.id}`, { action: 'revoke' });
const afterRevoke = await listInvitations();
const newTokenResponse = await tryActivation(tokenFrom(resent.activationUrl));
if (!(await switchTo(seePoint.id)).ok) throw new Error('Could not switch back to SeePoint.');
const foreignResponse = await patch(`/api/organization/invitations/${replacement.id}`, { action: 'resend' });

const result = {
  create: createResponse.status,
  listed: Boolean(original),
  roleUpdate: roleResponse.status,
  roleUpdated,
  resend: resendResponse.status,
  replacementCreated: replacement.id !== original.id,
  oldTokenAfterResend: oldTokenResponse.status,
  revoke: revokeResponse.status,
  removedFromPendingList: !afterRevoke.some((invitation) => invitation.email === invitedEmail),
  newTokenAfterRevoke: newTokenResponse.status,
  foreignTenantMutation: foreignResponse.status,
};
console.log(JSON.stringify(result, null, 2));
if (![200, 201].includes(result.create) || !result.listed || result.roleUpdate !== 200 || !result.roleUpdated || result.resend !== 200 || !result.replacementCreated || result.oldTokenAfterResend !== 400 || result.revoke !== 200 || !result.removedFromPendingList || result.newTokenAfterRevoke !== 400 || result.foreignTenantMutation !== 404) process.exitCode = 1;
