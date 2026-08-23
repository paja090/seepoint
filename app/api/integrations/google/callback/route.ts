import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/app-url';
import { requireOrganizationRole } from '@/lib/organization';
import { runWithTenantContext } from '@/lib/tenant-context';
import { verifyOAuthState } from '@/lib/integrations/integration-crypto';
import {
  exchangeGoogleAuthorizationCode,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  googleAccount,
  googleOAuthConfiguration,
  googleOAuthRedirectUri,
  saveGoogleConnection,
} from '@/lib/integrations/google-oauth';
import { assertGoogleTokenScopes } from '@/lib/integrations/google-oauth-policy';

function integrationsRedirect(request: Request, result: 'connected' | 'cancelled' | 'error') {
  return NextResponse.redirect(getAppUrl(request, `/settings/integrations?google=${result}`));
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', { path: '/api/integrations/google', maxAge: 0 });
  response.cookies.set(GOOGLE_OAUTH_VERIFIER_COOKIE, '', { path: '/api/integrations/google', maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has('error')) return clearOAuthCookies(integrationsRedirect(request, 'cancelled'));
  try {
    const context = await requireOrganizationRole('ADMIN');
    const config = googleOAuthConfiguration();
    const jar = await cookies();
    const stateValue = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const expectedNonce = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
    const verifier = jar.get(GOOGLE_OAUTH_VERIFIER_COOKIE)?.value;
    if (!stateValue || !code || !expectedNonce || !verifier) throw new Error('OAuth callback is incomplete.');
    const state = verifyOAuthState(stateValue, config.stateSecret);
    if (state.nonce !== expectedNonce || state.organizationId !== context.organizationId || state.userId !== context.user.id) {
      throw new Error('OAuth callback does not belong to the active organization session.');
    }
    const token = await exchangeGoogleAuthorizationCode({
      code,
      verifier,
      redirectUri: googleOAuthRedirectUri(request),
    });
    const grantedScopes = token.scope?.split(' ').filter(Boolean) ?? [];
    assertGoogleTokenScopes(state.provider, grantedScopes);
    const account = await googleAccount(token.access_token!);
    await runWithTenantContext(
      { organizationId: state.organizationId, userId: state.userId, source: 'session' },
      () => saveGoogleConnection({
        provider: state.provider,
        accountId: account.id,
        accountEmail: account.email,
        refreshToken: token.refresh_token,
        scopes: grantedScopes,
        expiresIn: token.expires_in,
      }),
    );
    return clearOAuthCookies(integrationsRedirect(request, 'connected'));
  } catch (error) {
    console.error('[google-oauth] Callback failed', error instanceof Error ? error.message : 'unknown error');
    return clearOAuthCookies(integrationsRedirect(request, 'error'));
  }
}
