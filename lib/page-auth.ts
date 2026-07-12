import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import { canAccess, type AppSection } from './rbac';

export async function requirePageAccess(section: AppSection) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccess(user.role, section)) redirect('/dashboard');
  return user;
}
