import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import { canAccess, type AppSection } from './rbac';
import { hasModuleAccess, moduleForSection } from './module-policy';

export async function requirePageAccess(section: AppSection, moduleId = moduleForSection(section)) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccess(user.role, section)) redirect('/dashboard');
  if (moduleId && !hasModuleAccess(user, moduleId, section)) redirect('/module-unavailable');
  return user;
}
