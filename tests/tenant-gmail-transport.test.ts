import assert from 'node:assert/strict';
import test from 'node:test';
import { runWithTenantContext } from '../lib/tenant-context';
import { sendGmailMessageWithToken, tenantGmailSender } from '../lib/integrations/gmail-sender';

const message = { from: 'qx@example.com', to: 'test@example.com', bcc: [], subject: 'Test', html: 'test', attachments: [] };
test('SeePoint bypasses tenant Gmail discovery without depending on a request context', async () => {
  assert.equal(await tenantGmailSender('org_seepoint_default'), null);
});
test('Gmail transport sends the authenticated mailbox and confirms the provider ID', async t => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    count++;
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    assert.equal((init.headers as Record<string, string>).authorization, 'Bearer qx-access');
    const mime = Buffer.from(JSON.parse(init.body as string).raw, 'base64url').toString();
    assert.match(mime, /From: qx@example.com/);
    assert.doesNotMatch(mime, /Bcc:|seepoint.cz/);
    return Response.json({ id: 'gmail-confirmed' });
  });
  assert.deepEqual(await sendGmailMessageWithToken('qx-access', message), { messageId: 'gmail-confirmed', from: 'qx@example.com' });
  assert.equal(count, 1);
});
test('Gmail rejection is not retried or reported as sent', async t => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => { count++; return Response.json({ error: 'denied' }, { status: 403 }); });
  await assert.rejects(() => sendGmailMessageWithToken('qx-access', message), /Gmail zprávu nepotvrdil/);
  assert.equal(count, 1);
});
test('missing provider confirmation is not reported as sent', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(() => sendGmailMessageWithToken('qx-access', message), /Gmail nevrátil potvrzení/);
});
test('a different tenant context fails before any token or data lookup', async () => {
  await assert.rejects(() => runWithTenantContext({ organizationId: 'other', source: 'test' }, () => tenantGmailSender('qx')), /Nesprávná organizace/);
});
