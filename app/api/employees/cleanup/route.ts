import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await getCurrentUser();
    if (!actor || !['ADMIN', 'MANAGER'].includes(actor.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
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

    const delUsers = await prisma.user.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Milan', mode: 'insensitive' } },
          { name: { contains: 'Pavel', mode: 'insensitive' } },
          { email: { contains: 'milan', mode: 'insensitive' } },
          { email: { contains: 'pavel', mode: 'insensitive' } },
        ],
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Smazáno ${delEmps.count} testovacích zaměstnanců a ${delUsers.count} uživatelů.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
