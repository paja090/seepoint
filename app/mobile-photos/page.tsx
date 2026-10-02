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
  if (!canAccess(user.role, 'navigationProjects') && !canAccess(user.role, 'carriers')) {
    redirect('/dashboard');
  }
  const hasNav = hasModuleAccess(user, 'navigation', 'navigationProjects');
  const hasCarriers = hasModuleAccess(user, 'carriers', 'carriers');
  if (!hasNav && !hasCarriers) {
    redirect('/module-unavailable');
  }

  return (
    <AppShell>
      <MobilePhotoFieldAppView />
    </AppShell>
  );
}
