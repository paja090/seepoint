import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'seepoint_session';
const publicExactPaths = new Set([
  '/',
  '/os',
  '/login',
  '/forgot-password',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/set-password',
]);

const publicPathPrefixes = [
  '/activate',
  '/reset-password',
  '/proposal',
  '/offer',
  '/client',
  '/images',
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
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|manifest.json|sw.js|offline.html|seepoint-logo.svg|seepoint-app-icon.svg|seepoint-app-icon-192.png|seepoint-app-icon-512.png|placeholder.svg).*)'],
};
