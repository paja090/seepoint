import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { emailBccRecipients, offerBccRecipients } from '../lib/email-policy';

test('tenant mail never inherits a platform BCC even when configured', () => {
  assert.deepEqual(emailBccRecipients({ organizationId: 'qx' }, 'another-company@example.com'), []);
  assert.deepEqual(emailBccRecipients({ organizationId: 'qx' }), []);
  assert.deepEqual(emailBccRecipients({ organizationId: 'qx', bcc: ['sales@qx.example'] }, 'another-company@example.com'), ['sales@qx.example']);
  assert.deepEqual(emailBccRecipients({ bcc: [] }, 'platform@example.com'), []);
});

test('offer sending uses tenant identity and never adds global copy recipients', () => {
  const email = readFileSync(new URL('../lib/email.ts', import.meta.url), 'utf8');
  const offerSending = email.slice(email.indexOf('export async function sendOfferEmail'), email.indexOf('export async function sendTenantTestEmail'));
  assert.doesNotMatch(offerSending, /info@seepoint|Obchodní kontakt SeePOINT/);
  assert.deepEqual(offerBccRecipients({ organizationId: 'qx', salespersonEmail: 'sales@qx.example' }, 'internal@seepoint.cz'), ['sales@qx.example']);
  assert.match(email, /emailBccRecipients\(input, process.env.EMAIL_BCC\)/);
  assert.match(email, /input.organizationId !== 'org_seepoint_default' && \(!tenantSenderVerified \|\| !resendApiKey\)/);
  const service = readFileSync(new URL('../lib/offers/service.ts', import.meta.url), 'utf8');
  const notifications = service.slice(service.indexOf('// Asynchronously send notification'), service.indexOf('export async function getPublicPhoto'));
  assert.doesNotMatch(notifications, /EMAIL_BCC|info@seepoint|row.contactEmail/);
});

test('original SeePoint organization preserves its configured internal copies', () => {
  assert.deepEqual(emailBccRecipients({ organizationId: 'org_seepoint_default' }, 'internal@seepoint.cz'), ['internal@seepoint.cz']);
  assert.deepEqual(offerBccRecipients({ organizationId: 'org_seepoint_default', salespersonEmail: 'sales@seepoint.cz' }, 'internal@seepoint.cz'), ['sales@seepoint.cz', 'internal@seepoint.cz']);
  assert.deepEqual(emailBccRecipients({ organizationId: 'org_seepoint_default', bcc: [] }, 'internal@seepoint.cz'), []);
});
