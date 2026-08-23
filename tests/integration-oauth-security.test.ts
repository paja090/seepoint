import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  signOAuthState,
  verifyOAuthState,
} from '../lib/integrations/integration-crypto.ts';
import { assertGoogleTokenScopes } from '../lib/integrations/google-oauth-policy.ts';

test('integration credentials use authenticated encryption and reject the wrong key', () => {
  const key = randomBytes(32).toString('base64');
  const sealed = encryptIntegrationSecret({ refreshToken: 'tenant-a-secret' }, key);
  assert.equal(sealed.includes('tenant-a-secret'), false);
  assert.deepEqual(decryptIntegrationSecret(sealed, key), { refreshToken: 'tenant-a-secret' });
  assert.throws(() => decryptIntegrationSecret(sealed, randomBytes(32).toString('base64')));
});

test('Google OAuth state is signed, expires and binds organization with user', () => {
  const secret = 'state-secret-that-is-longer-than-thirty-two-characters';
  const state = {
    v: 1 as const,
    organizationId: 'org-a',
    userId: 'user-a',
    provider: 'GOOGLE_DRIVE' as const,
    nonce: 'nonce-a',
    expiresAt: 10_000,
  };
  const signed = signOAuthState(state, secret);
  assert.deepEqual(verifyOAuthState(signed, secret, 9_999), state);
  assert.throws(() => verifyOAuthState(`${signed}x`, secret, 9_999));
  assert.throws(() => verifyOAuthState(signed, secret, 10_001));
});

test('integration records are tenant scoped with tenant unique provider', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const tenantLayer = readFileSync(new URL('../lib/tenant-prisma.ts', import.meta.url), 'utf8');
  assert.match(schema, /model IntegrationConnection[\s\S]*organizationId\s+String[\s\S]*@@unique\(\[organizationId, provider\]\)/);
  assert.match(tenantLayer, /'IntegrationConnection'/);
});

test('OAuth callback rejects a state for another organization before saving', () => {
  const callback = readFileSync(new URL('../app/api/integrations/google/callback/route.ts', import.meta.url), 'utf8');
  assert.match(callback, /state\.organizationId !== context\.organizationId/);
  assert.match(callback, /state\.userId !== context\.user\.id/);
  assert.match(callback, /state\.nonce !== expectedNonce/);
  assert.match(callback, /runWithTenantContext\([\s\S]*organizationId: state\.organizationId[\s\S]*userId: state\.userId/);
});

test('OAuth redirect supports one explicitly configured stable HTTPS origin', () => {
  const oauth = readFileSync(new URL('../lib/integrations/google-oauth.ts', import.meta.url), 'utf8');
  assert.match(oauth, /GOOGLE_OAUTH_REDIRECT_ORIGIN/);
  assert.match(oauth, /origin\.startsWith\('https:\/\/'\)/);
  assert.match(oauth, /\/api\/integrations\/google\/callback/);
});

test('Google Drive connection rejects inherited broad scopes', () => {
  assert.doesNotThrow(() => assertGoogleTokenScopes('GOOGLE_DRIVE', [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive.file',
  ]));
  assert.throws(() => assertGoogleTokenScopes('GOOGLE_DRIVE', [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive',
  ]), /širší oprávnění/);
  assert.throws(() => assertGoogleTokenScopes('GOOGLE_DRIVE', ['openid']), /drive\.file/);
});
