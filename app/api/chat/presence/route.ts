import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { roleLabel } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const activeUsers = await prisma.organizationMember.findMany({
    where: {
      organizationId: user.organizationId!,
      isActive: true,
      user: { status: 'ACTIVE' },
    },
    select: {
      role: true,
      user: {
        select: {
          id: true,
          name: true,
          lastLoginAt: true,
          employees: {
            where: { organizationId: user.organizationId! },
            select: {
              firstName: true,
              lastName: true,
              position: true,
              photos: { select: { url: true }, take: 1 },
            },
            take: 1,
          },
        },
      },
    },
    take: 30,
  });

  return NextResponse.json(
    activeUsers
      .sort((left, right) => (right.user.lastLoginAt?.getTime() ?? 0) - (left.user.lastLoginAt?.getTime() ?? 0))
      .map((membership) => {
        const employee = membership.user.employees[0];
        return {
          id: membership.user.id,
          name: employee ? `${employee.firstName} ${employee.lastName}`.trim() : membership.user.name,
          roleLabel: roleLabel(membership.role === 'OWNER' ? 'ADMIN' : membership.role),
          position: employee?.position || null,
          photoUrl: employee?.photos[0]?.url || null,
          lastActive: membership.user.lastLoginAt?.toISOString() || null,
        };
      })
  );
}
