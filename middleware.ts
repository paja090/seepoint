import { NextRequest, NextResponse } from 'next/server';
const SESSION_COOKIE = 'seepoint_session';
const publicPaths = ['/login', '/forgot-password', '/activate', '/reset-password', '/api/auth'];
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (publicPaths.some((item) => path === item || path.startsWith(`${item}/`))) return NextResponse.next();
  if (!request.cookies.has(SESSION_COOKIE)) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|seepoint-logo.svg|placeholder.svg).*)'] };
