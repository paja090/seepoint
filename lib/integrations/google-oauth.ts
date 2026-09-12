import { createHash, randomBytes } from 'node:crypto';
import type { IntegrationProvider } from '@prisma/client';
import { getAppUrl } from '@/lib/app-url';
import { prisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';
import { decryptIntegrationSecret, encryptIntegrationSecret } from './integration-crypto';

export const GOOGLE_OAUTH_STATE_COOKIE = 'seepoint_google_oauth_state';
export const GOOGLE_OAUTH_VERIFIER_COOKIE = 'seepoint_google_oauth_verifier';

type GoogleCredentials = { refreshToken: string };

export async function connectedGoogleAccessToken(provider: IntegrationProvider, connectionId?: string) {
  const connection = await prisma.integrationConnection.findFirst({
    where: connectionId ? { id: connectionId } : { provider },
    select: { id: true, status: true, credentialsEncrypted: true, provider: true },
  });
  if (!connection || connection.status === 'REVOKED') return null;
  const providerLabel = connection.provider === 'GMAIL' ? 'Gmail' : 'Google Drive';
  if (!connection.credentialsEncrypted) {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: 'ERROR',
        lastCheckedAt: new Date(),
        expiresAt: null,
        error: `${providerLabel} připojení nemá obnovovací token a je potřeba ho připojit znovu.`,
      },
    });
    return null;
  }

  const config = googleOAuthConfiguration();
  try {
    const { refreshToken } = decryptIntegrationSecret<GoogleCredentials>(connection.credentialsEncrypted, config.encryptionKey);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      cache: 'no-store',
    });
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!response.ok || !data.access_token) throw new Error('Google OAuth access token refresh failed.');
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: 'CONNECTED',
        lastCheckedAt: new Date(),
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
        error: null,
      },
    });
    return data.access_token;
  } catch (error) {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: 'ERROR',
        lastCheckedAt: new Date(),
        expiresAt: null,
        error: `${providerLabel} připojení vyžaduje znovu ověřit.`,
      },
    }).catch(() => undefined);
    throw error;
  }
}

function cleanConfigValue(val?: string) {
  if (!val) return '';
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

export function googleOAuthConfiguration() {
  const clientId = cleanConfigValue(process.env.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret = cleanConfigValue(process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  const stateSecret = cleanConfigValue(process.env.GOOGLE_OAUTH_STATE_SECRET);
  const encryptionKey = cleanConfigValue(process.env.INTEGRATION_ENCRYPTION_KEY);
  const isKeyValid = Boolean(
    encryptionKey &&
    (Buffer.from(encryptionKey, 'base64').length === 32 || Buffer.from(encryptionKey, 'utf8').length === 32)
  );
  if (
    !clientId || !clientSecret || !stateSecret || stateSecret.length < 32
    || !encryptionKey || !isKeyValid
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
  const configuredOrigin = cleanConfigValue(process.env.GOOGLE_OAUTH_REDIRECT_ORIGIN);
  if (!configuredOrigin) return getAppUrl(request, '/api/integrations/google/callback');
  const origin = new URL(configuredOrigin).origin;
  if (!origin.startsWith('https://') && !origin.startsWith('http://localhost')) {
    throw new Error('Google OAuth redirect origin musí používat HTTPS.');
  }
  return new URL('/api/integrations/google/callback', `${origin}/`).toString();
}

export function googleScopes(provider: IntegrationProvider) {
  if (provider === 'GOOGLE_DRIVE') {
    return ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file'];
  }
  if (provider === 'GMAIL') {
    return ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'];
  }
  throw new Error('Tato Google integrace zatím není podporovaná.');
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
  const existing = input.provider === 'GMAIL'
    ? await prisma.integrationConnection.findFirst({ where: { provider: input.provider, externalAccountId: input.accountId } })
    : await prisma.integrationConnection.findFirst({ where: { provider: input.provider } });
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

export async function disconnectGoogleConnection(provider: IntegrationProvider, connectionId?: string) {
  const config = googleOAuthConfiguration();
  const connection = await prisma.integrationConnection.findFirst({
    where: connectionId ? { id: connectionId } : { provider },
  });
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
