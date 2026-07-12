import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  // Never allow in production
  if (process.env.VERCEL_ENV === 'production') {
    return new Response('Forbidden', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get('redirect') ?? '/carriers/c1';

  // Find the first active ADMIN user
  const admin = await prisma.user.findFirst({
    where: {
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  if (!admin) {
    return NextResponse.json({ error: 'No admin user found in database.' }, { status: 404 });
  }

  await createSession(admin.id, admin.sessionVersion);

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  return response;
}
