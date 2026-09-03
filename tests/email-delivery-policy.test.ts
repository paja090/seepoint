import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isValidEmailAddress, isValidEmailIdempotencyKey, skippedEmailEnvironment } from '../lib/email-policy.ts';

test('Preview delivery is suppressed unless explicitly enabled', () => {
  assert.equal(skippedEmailEnvironment({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), 'preview');
  assert.equal(skippedEmailEnvironment({ NODE_ENV: 'production', VERCEL_ENV: 'preview', EMAIL_SEND_IN_PREVIEW: 'false' }), 'preview');
  assert.equal(skippedEmailEnvironment({ NODE_ENV: 'production', VERCEL_ENV: 'preview', EMAIL_SEND_IN_PREVIEW: 'true' }), null);
  assert.equal(skippedEmailEnvironment({ NODE_ENV: 'production', VERCEL_ENV: 'production' }), null);
  assert.equal(skippedEmailEnvironment({ NODE_ENV: 'development' }), 'development');
});

test('Email addresses and provider idempotency keys reject unsafe input', () => {
  assert.equal(isValidEmailAddress('client@example.cz'), true);
  assert.equal(isValidEmailAddress('client@example.cz\r\nBcc: attacker@example.cz'), false);
  assert.equal(isValidEmailAddress('missing-at.example.cz'), false);
  assert.equal(isValidEmailIdempotencyKey('navigation-invoice/cinvoice-1'), true);
  assert.equal(isValidEmailIdempotencyKey('unsafe key with spaces'), false);
});

test('Business routes only persist SENT after confirmed delivery', () => {
  const offer = readFileSync(new URL('../app/api/offers/[id]/send/route.ts', import.meta.url), 'utf8');
  const documentation = readFileSync(new URL('../app/api/navigation/documentation/[id]/send-email/route.ts', import.meta.url), 'utf8');
  const invoice = readFileSync(new URL('../app/api/navigation/orders/[id]/invoice/route.ts', import.meta.url), 'utf8');

  for (const route of [offer, documentation, invoice]) {
    assert.match(route, /\.status === 'skipped'/);
    assert.match(route, /status: 202/);
  }
  assert.match(invoice, /data: \{ status: 'SENT' \}/);
  assert.match(documentation, /status: report\.status === 'ARCHIVED' \? 'ARCHIVED' : 'SENT'/);
});

test('Configured provider does not silently fall through to another provider after rejection', () => {
  const email = readFileSync(new URL('../lib/email.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(email, /trying another configured provider/);
  assert.match(email, /AbortSignal\.timeout\(EMAIL_TIMEOUT_MS\)/);
  assert.match(email, /webhookUrl\.protocol !== 'https:'/);
});
