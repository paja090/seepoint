import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { IntegrationProvider } from '@prisma/client';
import { getAppUrl } from '@/lib/app-url';
import { prisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';
import { decryptIntegrationSecret, encryptIntegrationSecret } from './integration-crypto';

export const GOOGLE_OAUTH_STATE_COOKIE = 'seepoint_google_oauth_state';
export const GOOGLE_OAUTH_VERIFIER_COOKIE = 'seepoint_google_oauth_verifier';

type GoogleCredentials = { refreshToken: string };

export function googleOAuthConfiguration() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET?.trim();
  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (
    !clientId || !clientSecret || !stateSecret || stateSecret.length < 32
    || !encryptionKey || Buffer.from(encryptionKey, 'base64').length !== 32
  ) {
    throw new Error('Google OAuth integrace není nakonfigurovaná.');
  }
  return { clientId, clientSecret, stateSecret, encryptionKey };
}

export function isGoogleOAuthConfigured() {
  try {
    googleOAuthConfiguration();
    return true;
  } catch {
    return false;
  }
}

export function googleOAuthRedirectUri(request: Request) {
  const configuredOrigin = process.env.GOOGLE_OAUTH_REDIRECT_ORIGIN?.trim();
  if (!configuredOrigin) return getAppUrl(request, '/api/integrations/google/callback');
  const origin = new URL(configuredOrigin).origin;
  if (!origin.startsWith('https://') && !origin.startsWith('http://localhost')) {
    throw new Error('Google OAuth redirect origin musí používat HTTPS.');
  }
  return new URL('/api/integrations/google/callback', `${origin}/`).toString();
}

export function googleScopes(provider: IntegrationProvider) {
  if (provider !== 'GOOGLE_DRIVE') throw new Error('Tato Google integrace zatím není podporovaná.');
  return ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file'];
}

export function createPkceVerifier() {
  return randomBytes(48).toString('base64url');
}

export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function googleAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string; verifier: string; provider: IntegrationProvider }) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: googleScopes(input.provider).join(' '),
    state: input.state,
    code_challenge: pkceChallenge(input.verifier),
    code_challenge_method: 'S256',
  }).toString();
  return url;
}

export async function exchangeGoogleAuthorizationCode(input: { code: string; verifier: string; redirectUri: string }) {
  const config = googleOAuthConfiguration();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: input.verifier,
    }),
    cache: 'no-store',
  });
  const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || 'Google OAuth token exchange failed.');
  return data;
}

export async function googleAccount(accessToken: string) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const data = await response.json() as { sub?: string; email?: string; email_verified?: boolean };
  if (!response.ok || !data.sub || !data.email || data.email_verified !== true) throw new Error('Google účet se nepodařilo bezpečně ověřit.');
  return { id: data.sub, email: data.email };
}

export async function saveGoogleConnection(input: { provider: IntegrationProvider; accountId: string; accountEmail: string; refreshToken?: string; scopes: string[]; expiresIn?: number }) {
  const { organizationId } = requireTenantContext();
  const config = googleOAuthConfiguration();
  const existing = await prisma.integrationConnection.findFirst({ where: { provider: input.provider } });
  let refreshToken = input.refreshToken;
  if (!refreshToken && existing?.credentialsEncrypted) {
    refreshToken = decryptIntegrationSecret<GoogleCredentials>(existing.credentialsEncrypted, config.encryptionKey).refreshToken;
  }
  if (!refreshToken) throw new Error('Google nevrátil obnovovací token. Zrušte přístup SeePointu v Google účtu a zkuste připojení znovu.');
  const data = {
    provider: input.provider,
    status: 'CONNECTED' as const,
    externalAccountId: input.accountId,
    accountEmail: input.accountEmail,
    credentialsEncrypted: encryptIntegrationSecret({ refreshToken }, config.encryptionKey),
    scopes: input.scopes,
    connectedAt: new Date(),
    expiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000) : null,
    lastCheckedAt: new Date(),
    error: null,
  };
  if (existing) return prisma.integrationConnection.update({ where: { id: existing.id }, data });
  return prisma.integrationConnection.create({ data: { ...data, organizationId } });
}

export async function disconnectGoogleConnection(provider: IntegrationProvider) {
  const config = googleOAuthConfiguration();
  const connection = await prisma.integrationConnection.findFirst({ where: { provider } });
  if (!connection) return false;
  if (connection.credentialsEncrypted) {
    const { refreshToken } = decryptIntegrationSecret<GoogleCredentials>(connection.credentialsEncrypted, config.encryptionKey);
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }
  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: { status: 'REVOKED', credentialsEncrypted: null, expiresAt: null, error: null },
  });
  return true;
}
