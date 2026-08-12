import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { roleLabel } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  // Fetch active users in the system
  const activeUsers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
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
    take: 30,
  });

  return NextResponse.json(
    activeUsers.map((u) => ({
      id: u.id,
      name: u.employee ? `${u.employee.firstName} ${u.employee.lastName}`.trim() : u.name,
      roleLabel: roleLabel(u.role),
      position: u.employee?.position || null,
      photoUrl: u.employee?.photos[0]?.url || null,
      lastActive: u.lastLoginAt?.toISOString() || null,
    }))
  );
}
