import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'seepoint_session';
const publicExactPaths = new Set([
  '/',
  '/os',
  '/join-network',
  '/login',
  '/forgot-password',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/set-password',
  // Provider callbacks authenticate with their Svix signature in the handler.
  '/api/webhooks/resend',
  // Email 1-click task confirmation and action pages authenticate with HMAC-SHA256 token in the handler.
  '/api/work-orders/ack-email',
  '/api/work-orders/email-action',
  // Vercel crons have no browser session; every handler requires Bearer CRON_SECRET.
  '/api/cron/planner',
  '/api/cron/ai-inbox',
  '/api/cron/sales-radar',
  '/api/cron/daily-briefing',
  '/api/cron/google-sheet-plan',
  '/api/cron/occupancy-intelligence',
]);

const publicPathPrefixes = [
  '/activate',
  '/reset-password',
  '/proposal',
  '/offer',
  '/campaign',
  '/p',
  '/client',
  '/images',
  '/data',
  '/api/proposals',
  '/api/client',
  '/api/leads',
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicPath = publicExactPaths.has(path)
    || publicPathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (isPublicPath) return NextResponse.next();
  if (!request.cookies.has(SESSION_COOKIE)) {
    if (path === '/api/integrations/google/connect') {
      return NextResponse.redirect(new URL('/login?returnTo=/settings/integrations', request.url));
    }
    if (path === '/api/integrations/google/callback') {
      return NextResponse.redirect(new URL('/settings/integrations?google=error', request.url));
    }
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|data|manifest.json|sw.js|offline.html|seepoint-logo.svg|seepoint-app-icon.svg|seepoint-app-icon-192.png|seepoint-app-icon-512.png|placeholder.svg).*)'],
};
