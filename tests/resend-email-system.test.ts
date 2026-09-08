import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { decryptTenantCredential, encryptTenantCredential } from '../lib/email-encryption.ts';
import { verifyResendWebhookSignature } from '../lib/resend-service.ts';

test('AES-256-GCM encryption roundtrip encrypts and restores secret API key', () => {
  const secretKey = crypto.randomBytes(32).toString('base64');
  process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = secretKey;

  const originalToken = 're_live_domain_key_9876543210_abcdef';
  const encrypted = encryptTenantCredential(originalToken);

  // Encrypted format is iv:authTag:ciphertext
  assert.equal(typeof encrypted, 'string');
  const parts = encrypted.split(':');
  assert.equal(parts.length, 3, 'Payload should have iv, authTag, and ciphertext');

  const decrypted = decryptTenantCredential(encrypted);
  assert.equal(decrypted, originalToken);
});

test('AES-256-GCM detects tampering and rejects compromised credentials', () => {
  const secretKey = crypto.randomBytes(32).toString('base64');
  process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = secretKey;

  const originalToken = 're_tenant_secret_key_12345';
  const encrypted = encryptTenantCredential(originalToken);
  const [ivBase64, authTagBase64, cipherBase64] = encrypted.split(':');

  // 1. Tamper with ciphertext
  const tamperedCipher = Buffer.from(cipherBase64, 'base64');
  tamperedCipher[0] = tamperedCipher[0] ^ 0xff;
  assert.throws(
    () => decryptTenantCredential(`${ivBase64}:${authTagBase64}:${tamperedCipher.toString('base64')}`),
    /Dešifrování pověření selhalo nebo byla data poškozena/
  );

  // 2. Tamper with auth tag
  const tamperedTag = Buffer.from(authTagBase64, 'base64');
  tamperedTag[0] = tamperedTag[0] ^ 0xff;
  assert.throws(
    () => decryptTenantCredential(`${ivBase64}:${tamperedTag.toString('base64')}:${cipherBase64}`),
    /Dešifrování pověření selhalo nebo byla data poškozena/
  );

  // 3. Tamper with IV
  const tamperedIv = Buffer.from(ivBase64, 'base64');
  tamperedIv[0] = tamperedIv[0] ^ 0xff;
  assert.throws(
    () => decryptTenantCredential(`${tamperedIv.toString('base64')}:${authTagBase64}:${cipherBase64}`),
    /Dešifrování pověření selhalo nebo byla data poškozena/
  );

  // 4. Corrupted format
  assert.throws(() => decryptTenantCredential('corrupted-payload'), /Neplatný formát/);
  assert.throws(() => decryptTenantCredential('one:two'), /Neplatná struktura/);
});

test('Resend Svix webhook signature verification allows valid authentic payloads', () => {
  const rawSecret = crypto.randomBytes(32);
  const webhookSecret = `whsec_${rawSecret.toString('base64')}`;
  process.env.RESEND_WEBHOOK_SECRET = webhookSecret;

  const now = Math.floor(Date.now() / 1000);
  const id = 'msg_2rXzABC123456';
  const timestamp = String(now);
  const body = JSON.stringify({
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: {
      email_id: '58f121d5-fc19-482a-a92e-333e680a6d5d',
      from: 'nabidky@seepoint.cz',
      to: ['klient@firma.cz'],
      subject: 'Cenová nabídka OOH',
    },
  });

  const signedPayload = `${id}.${timestamp}.${body}`;
  const validSignature = crypto.createHmac('sha256', rawSecret).update(signedPayload).digest('base64');

  const isValid = verifyResendWebhookSignature(body, {
    id,
    timestamp,
    signature: `v1,${validSignature}`,
  });

  assert.equal(isValid, true, 'Valid Svix signature should pass verification');
});

test('Resend Svix webhook rejects tampered payload or forged signature', () => {
  const rawSecret = crypto.randomBytes(32);
  const webhookSecret = `whsec_${rawSecret.toString('base64')}`;
  process.env.RESEND_WEBHOOK_SECRET = webhookSecret;

  const now = Math.floor(Date.now() / 1000);
  const id = 'msg_2rXzABC123456';
  const timestamp = String(now);
  const originalBody = JSON.stringify({ type: 'email.delivered', data: { email_id: '123' } });
  const tamperedBody = JSON.stringify({ type: 'email.bounced', data: { email_id: '123' } });

  const signedPayload = `${id}.${timestamp}.${originalBody}`;
  const validSignature = crypto.createHmac('sha256', rawSecret).update(signedPayload).digest('base64');

  // Payload mismatch
  assert.equal(
    verifyResendWebhookSignature(tamperedBody, {
      id,
      timestamp,
      signature: `v1,${validSignature}`,
    }),
    false,
    'Tampered body must fail verification'
  );

  // Forged signature
  assert.equal(
    verifyResendWebhookSignature(originalBody, {
      id,
      timestamp,
      signature: 'v1,totally_invalid_signature_base64_hash',
    }),
    false,
    'Forged signature must fail verification'
  );

  // Replay attack / expired timestamp (> 300s)
  const expiredTimestamp = String(now - 305);
  const expiredPayload = `${id}.${expiredTimestamp}.${originalBody}`;
  const expiredSig = crypto.createHmac('sha256', rawSecret).update(expiredPayload).digest('base64');

  assert.equal(
    verifyResendWebhookSignature(originalBody, {
      id,
      timestamp: expiredTimestamp,
      signature: `v1,${expiredSig}`,
    }),
    false,
    'Stale webhook event (> 5 min) must be rejected to prevent replay attacks'
  );
});

test('Resend Svix webhook handles multiple comma/space separated signatures', () => {
  const rawSecret = crypto.randomBytes(32);
  const webhookSecret = `whsec_${rawSecret.toString('base64')}`;
  process.env.RESEND_WEBHOOK_SECRET = webhookSecret;

  const now = Math.floor(Date.now() / 1000);
  const id = 'msg_multisig_test';
  const timestamp = String(now);
  const body = '{"status":"ok"}';

  const signedPayload = `${id}.${timestamp}.${body}`;
  const validSignature = crypto.createHmac('sha256', rawSecret).update(signedPayload).digest('base64');

  const multiSigHeader = `v1,oldinvalidhash v1,${validSignature} v2,someotherformat`;
  assert.equal(
    verifyResendWebhookSignature(body, {
      id,
      timestamp,
      signature: multiSigHeader,
    }),
    true,
    'Should correctly find valid signature in multi-signature header'
  );
});

test('Resend domain normalization and tenant From address policy', () => {
  const cleanDomain = (raw: string) => raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  assert.equal(cleanDomain('HTTPS://Seepoint.CZ/'), 'seepoint.cz');
  assert.equal(cleanDomain('  outdoor-kampan.cz  '), 'outdoor-kampan.cz');

  // Verify from address domain matching
  const verifyFromDomain = (fromAddress: string, domain: string) => {
    const match = fromAddress.match(/@([^>]+)>?$/);
    return match ? match[1].toLowerCase() === domain.toLowerCase() : false;
  };

  assert.equal(verifyFromDomain('nabidky@seepoint.cz', 'seepoint.cz'), true);
  assert.equal(verifyFromDomain('Jan Novák <jan.novak@seepoint.cz>', 'seepoint.cz'), true);
  assert.equal(verifyFromDomain('attacker@spammer.com', 'seepoint.cz'), false);
  assert.equal(verifyFromDomain('info@subdomain.seepoint.cz', 'seepoint.cz'), false);
});

test('Resend API key sanitization strips surrounding quotes and whitespace', () => {
  const sanitize = (raw?: string) => raw?.trim().replace(/^["']|["']$/g, '');
  assert.equal(sanitize('  re_1234567890_abcdef  '), 're_1234567890_abcdef');
  assert.equal(sanitize('"re_quoted_key_123"'), 're_quoted_key_123');
  assert.equal(sanitize("'re_single_quoted_key'"), 're_single_quoted_key');
  assert.equal(sanitize(undefined), undefined);
});

