import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.platformRole !== 'SUPER_ADMIN' || process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Nenalezeno.' }, { status: 404 });
    }

    const delEmps = await prisma.employee.deleteMany({
      where: {
        OR: [
          { firstName: { contains: 'Milan', mode: 'insensitive' } },
          { lastName: { contains: 'Manager', mode: 'insensitive' } },
          { firstName: { contains: 'Pavel', mode: 'insensitive' } },
          { lastName: { contains: 'Pracovník', mode: 'insensitive' } },
          { lastName: { contains: 'Pracovnik', mode: 'insensitive' } },
        ],
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Smazáno ${delEmps.count} testovacích zaměstnanců v aktivní organizaci.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
