import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { roleLabel } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  // Active users in last 30 minutes
  const activeThreshold = new Date(Date.now() - 30 * 60 * 1000);

  const activeUsers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      lastLoginAt: { gte: activeThreshold },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      lastLoginAt: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          position: true,
          photos: { select: { url: true }, take: 1 },
        },
      },
    },
    orderBy: { lastLoginAt: 'desc' },
  });

  return NextResponse.json(
    activeUsers.map((u) => ({
      id: u.id,
      name: u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.name,
      roleLabel: roleLabel(u.role),
      position: u.employee?.position || null,
      photoUrl: u.employee?.photos[0]?.url || null,
      lastActive: u.lastLoginAt?.toISOString() || null,
    }))
  );
}
