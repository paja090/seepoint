import { NextResponse } from 'next/server';
import { requireOrganizationRole } from '@/lib/organization';
import { createOAuthNonce, signOAuthState } from '@/lib/integrations/integration-crypto';
import {
  createPkceVerifier,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  googleAuthorizationUrl,
  googleOAuthConfiguration,
  googleOAuthRedirectUri,
} from '@/lib/integrations/google-oauth';

export async function GET(request: Request) {
  try {
    const context = await requireOrganizationRole('ADMIN');
    const config = googleOAuthConfiguration();
    const nonce = createOAuthNonce();
    const verifier = createPkceVerifier();
    const redirectUri = googleOAuthRedirectUri(request);
    const state = signOAuthState({
      v: 1,
      organizationId: context.organizationId,
      userId: context.user.id,
      provider: 'GOOGLE_DRIVE',
      nonce,
      expiresAt: Date.now() + 10 * 60 * 1000,
    }, config.stateSecret);
    const response = NextResponse.redirect(googleAuthorizationUrl({
      clientId: config.clientId,
      redirectUri,
      state,
      verifier,
      provider: 'GOOGLE_DRIVE',
    }));
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/integrations/google',
      maxAge: 10 * 60,
    };
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, nonce, cookieOptions);
    response.cookies.set(GOOGLE_OAUTH_VERIFIER_COOKIE, verifier, cookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error && error.message.includes('není nakonfigurovaná')
      ? error.message
      : 'Google účet se nepodařilo připojit.';
    return NextResponse.json({ error: message }, { status: message.includes('nakonfigurovaná') ? 503 : 403 });
  }
}
