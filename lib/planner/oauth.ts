import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAppUrl } from '@/lib/app-url';
import { createPkceVerifier, pkceChallenge, googleOAuthConfiguration, exchangeGoogleAuthorizationCode, googleAccount } from '@/lib/integrations/google-oauth';
import { createOAuthNonce, encryptIntegrationSecret, decryptIntegrationSecret } from '@/lib/integrations/integration-crypto';
import type { AuthenticatedPlannerActor } from './auth';
import { calendarScopes } from './providers/google';
import { assertCalendarEnabled } from './connections';
import { PlannerError } from './domain';
import { validateCalendarOAuthSession, type CalendarOAuthSession as OAuthSession } from './oauth-state';
const cookieName = 'seepoint_planner_oauth';
const cookiePath = '/api/planner/calendar';
export function calendarRedirectUri(request: Request) {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_ORIGIN?.trim();
  return configured ? new URL('/api/planner/calendar/callback', configured).toString() : getAppUrl(request, '/api/planner/calendar/callback');
}
export async function startCalendarOAuth(actor: AuthenticatedPlannerActor, request: Request) {
  assertCalendarEnabled(actor);
  const config = googleOAuthConfiguration();
  const state: OAuthSession = { organizationId: actor.organizationId, userId: actor.id, nonce: createOAuthNonce(), verifier: createPkceVerifier(), expiresAt: Date.now() + 600000 };
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: calendarRedirectUri(request), response_type: 'code', access_type: 'offline', prompt: 'consent', scope: calendarScopes.join(' '), state: state.nonce, code_challenge: pkceChallenge(state.verifier), code_challenge_method: 'S256' }).toString();
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(cookieName, encryptIntegrationSecret(state, config.encryptionKey), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: cookiePath, maxAge: 600 });
  return response;
}
export async function finishCalendarOAuth(actor: AuthenticatedPlannerActor, request: Request) {
  assertCalendarEnabled(actor);
  const config = googleOAuthConfiguration(), jar = await cookies(), url = new URL(request.url);
  const value = jar.get(cookieName)?.value;
  // Never accept state or PKCE verifier from URL as a fallback for a missing cookie.
  if (!value) throw new PlannerError('Připojení vypršelo. Spusťte jej znovu.', 400);
  const state = decryptIntegrationSecret<OAuthSession>(value, config.encryptionKey);
  validateCalendarOAuthSession(state, actor, url.searchParams.get('state'));
  if (!url.searchParams.get('code') || url.searchParams.has('error')) throw new PlannerError('Připojení bylo zrušeno.');
  const token = await exchangeGoogleAuthorizationCode({ code: url.searchParams.get('code')!, verifier: state.verifier, redirectUri: calendarRedirectUri(request) });
  const scopes = token.scope?.split(' ') || [];
  if (!calendarScopes.filter(s => s.startsWith('https:')).every(s => scopes.includes(s))) throw new PlannerError('Google nepovolil čtení kalendářů.');
  const account = await googleAccount(token.access_token!);
  const identity = { organizationId: actor.organizationId, userId: actor.id, provider: 'GOOGLE', providerAccountId: account.id };
  await prisma.$transaction(async tx => {
    const member = await tx.organizationMember.findFirst({ where: { organizationId: actor.organizationId, userId: actor.id, isActive: true, user: { status: 'ACTIVE' } } });
    if (!member) throw new PlannerError('Členství již není aktivní.', 403);
    const previous = await tx.calendarConnection.findUnique({ where: { organizationId_userId_provider_providerAccountId: identity } });
    const credentialsEncrypted = token.refresh_token ? encryptIntegrationSecret({ refreshToken: token.refresh_token }, config.encryptionKey) : previous?.status === 'CONNECTED' ? previous.credentialsEncrypted : null;
    if (!credentialsEncrypted) throw new PlannerError('Google nevrátil obnovovací oprávnění. Připojte účet znovu.');
    const data = { email: account.email, status: 'CONNECTED', credentialsEncrypted, scopes, connectedAt: new Date(), errorCode: null, retryAt: null, syncLeaseId: null, syncLeaseUntil: null, syncStatus: 'IDLE' };
    const connection = await tx.calendarConnection.upsert({ where: { organizationId_userId_provider_providerAccountId: identity }, create: { ...identity, ...data }, update: data });
    await tx.userAuditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.id, targetUserId: actor.id, action: 'PLANNER_CHANGED', metadata: { event: 'CALENDAR_CONNECTED', connectionId: connection.id } } });
  });
}
export function oauthResult(request: Request, result: string) {
  const response = NextResponse.redirect(getAppUrl(request, `/settings/planner?calendar=${result}`), 303);
  response.cookies.set(cookieName, '', { httpOnly: true, path: cookiePath, maxAge: 0 });
  return response;
}
