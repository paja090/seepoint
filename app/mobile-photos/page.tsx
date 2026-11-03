import { AppShell } from '@/components/AppShell';
import { MobilePhotoFieldAppView } from '@/components/navigation/MobilePhotoFieldAppView';

import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { hasModuleAccess } from '@/lib/module-policy';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MobilePhotosPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isTeamRole = ['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN', 'WORKER'].includes(user.role);
  if (!isTeamRole && !canAccess(user.role, 'navigationProjects') && !canAccess(user.role, 'carriers')) {
    redirect('/dashboard');
  }
  const hasAccess =
    hasModuleAccess(user, 'photoDocumentation', 'photoDocumentation') ||
    hasModuleAccess(user, 'navigation', 'navigationProjects') ||
    hasModuleAccess(user, 'carriers', 'carriers') ||
    hasModuleAccess(user, 'work', 'work');
  if (!hasAccess) {
    redirect('/module-unavailable');
  }

  return (
    <AppShell>
      <MobilePhotoFieldAppView />
    </AppShell>
  );
}
