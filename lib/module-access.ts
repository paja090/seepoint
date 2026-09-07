import 'server-only';
import { getCurrentUser } from './auth';
import { hasModuleAccess } from './module-policy';

export async function requireModuleAccess(moduleId: string) {
  const user = await getCurrentUser();
  if (!user || !hasModuleAccess(user, moduleId)) throw new Error('Modul není dostupný nebo nemáte oprávnění.');
  return user;
}
