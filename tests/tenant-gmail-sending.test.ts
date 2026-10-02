import assert from 'node:assert/strict';
import test from 'node:test';
import { GMAIL_SEND_SCOPE, gmailRawMessage, selectGmailSender } from '../lib/integrations/gmail-message';
import { assertGoogleTokenScopes } from '../lib/integrations/google-oauth-policy';

const read = 'https://www.googleapis.com/auth/gmail.readonly';
const sender = { id: 'a', organizationId: 'qx', provider: 'GMAIL', status: 'CONNECTED', accountEmail: 'qx@example.com', scopes: [read, GMAIL_SEND_SCOPE], settings: { sendingEnabled: true } };

test('SeePoint keeps its existing mail transport even if Gmail has a send grant', () => {
  assert.equal(selectGmailSender([{ ...sender, organizationId: 'org_seepoint_default' }, sender], 'org_seepoint_default'), null);
});
test('existing Gmail grants do not opt a company into the new sending transport', () => {
  assert.equal(selectGmailSender([{ ...sender, settings: undefined }], 'qx'), null);
  assert.equal(selectGmailSender([{ ...sender, settings: { sendingEnabled: false } }], 'qx'), null);
});

test('Gmail send requires explicit intent in addition to the granted scope', () => {
  assert.throws(() => assertGoogleTokenScopes('GMAIL', [read, GMAIL_SEND_SCOPE]));
  assert.throws(() => assertGoogleTokenScopes('GMAIL', [read], true));
  assert.doesNotThrow(() => assertGoogleTokenScopes('GMAIL', [read, GMAIL_SEND_SCOPE], true));
  assert.throws(() => assertGoogleTokenScopes('GMAIL', [read, GMAIL_SEND_SCOPE, 'https://mail.google.com/'], true));
});
test('sender cannot cross tenants, use read-only scopes, or fall back on an ambiguous/broken connection', () => {
  assert.equal(selectGmailSender([sender], 'other'), null);
  assert.equal(selectGmailSender([{ ...sender, scopes: [read] }], 'qx'), null);
  assert.equal(selectGmailSender([{ ...sender, status: 'REVOKED' }], 'qx'), null);
  assert.throws(() => selectGmailSender([{ ...sender, status: 'ERROR' }], 'qx'));
  assert.throws(() => selectGmailSender([sender, { ...sender, id: 'b' }], 'qx'));
  assert.equal(selectGmailSender([sender], 'qx')?.accountEmail, 'qx@example.com');
});
test('Gmail MIME preserves UTF-8 content and attachments without injecting platform recipients', () => {
  const raw = gmailRawMessage({ from: 'qx@example.com', to: 'pavel@example.com', bcc: [], subject: 'Nabídka QX', html: '<p>Příliš žluťoučký</p>', attachments: [{ filename: 'offer.pdf', contentType: 'application/pdf', content: Buffer.from('test-pdf') }] });
  const mime = Buffer.from(raw, 'base64url').toString();
  assert.match(mime, /From: qx@example.com\r\nTo: pavel@example.com\r\nReply-To: qx@example.com/);
  assert.ok(mime.includes(Buffer.from('Nabídka QX').toString('base64')));
  assert.ok(mime.includes(Buffer.from('<p>Příliš žluťoučký</p>').toString('base64')));
  assert.ok(mime.includes(Buffer.from('test-pdf').toString('base64')));
  assert.doesNotMatch(mime, /Bcc:|seepoint.cz/);
  assert.throws(() => gmailRawMessage({ from: 'qx@example.com', to: 'pavel@example.com\r\nBcc: evil@example.com', bcc: [], subject: 'Test', html: 'test', attachments: [] }));
});
