import { roleLabel } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ResponsiveAppShell } from './ResponsiveAppShell';
import { getVisibleNavigation } from '@/lib/navigation';
import { hasModuleAccess } from '@/lib/module-policy';

export async function AppShell({ children, allowPasswordChange = false }: { children: React.ReactNode; allowPasswordChange?: boolean }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.mustChangePassword && !allowPasswordChange) redirect('/profile?firstLogin=1');

  const visibleHubs = getVisibleNavigation(user);
  const utilityAccess = { team: hasModuleAccess(user, 'employees', 'team'), photos: hasModuleAccess(user, 'navigation', 'navigationProjects') };

  const userName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.email || 'Uživatel';

  const employeePhoto = user.employee?.id
    ? await prisma.photo.findFirst({
        where: { employeeId: user.employee.id, isPrimary: true },
        select: { url: true },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null)
    : null;

  const avatarUrl = employeePhoto?.url || null;

  const employees = user.organizationId
    ? await prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, position: true },
        orderBy: { firstName: 'asc' },
      }).catch(() => [])
    : [];

  return (
    <ResponsiveAppShell
      user={{
        id: user.id,
        name: userName,
        email: user.email || '',
        role: user.role,
        allowedRoles: user.allowedRoles || [user.role],
        organizationRoleLabel: user.membership?.role === 'OWNER' ? 'Vlastník organizace' : roleLabel(user.primaryRole),
        isPlatformSuperAdmin: user.platformRole === 'SUPER_ADMIN',
        avatarUrl,
        organizationId: user.organizationId || '',
        organizations: (user.memberships || []).map((membership) => ({
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
        })),
      }}
      employees={employees}
      visibleHubs={visibleHubs}
      utilityAccess={utilityAccess}
    >
      {children}
    </ResponsiveAppShell>
  );
}
