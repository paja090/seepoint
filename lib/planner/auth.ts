import 'server-only';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasModuleAccess } from '@/lib/module-policy';
import { runWithTenantContext } from '@/lib/tenant-context';
import { PlannerError } from './domain';
export async function plannerActor() {
  const user = await getCurrentUser();
  if (!user) throw new PlannerError('Přihlášení je vyžadováno.', 401);
  if (!user.organizationId || !hasModuleAccess(user, 'planner', 'planner')) throw new PlannerError('Planner není aktivovaný nebo k němu nemáte přístup.', 403);
  const member = await prisma.organizationMember.findFirst({ where: { organizationId: user.organizationId, userId: user.id, isActive: true, user: { status: 'ACTIVE' }, organization: { isActive: true } } });
  if (!member) throw new PlannerError('Členství není aktivní.', 403);
  return { ...user, organizationId: user.organizationId };
}
export type AuthenticatedPlannerActor = Awaited<ReturnType<typeof plannerActor>>;
export function plannerApi(request: Request, operation: (actor: AuthenticatedPlannerActor) => Promise<unknown>) {
  return (async () => {
    try {
      if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== new URL(request.url).origin) throw new PlannerError('Neplatný původ požadavku.', 403);
      const actor = await plannerActor();
      const result = await runWithTenantContext({ organizationId: actor.organizationId, userId: actor.id, source: 'session' }, () => operation(actor));
      return result instanceof Response ? result : NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
      if (error instanceof PlannerError) return NextResponse.json({ error: error.message }, { status: error.status });
      // Provider responses/credentials and private calendar titles must never be logged.
      return NextResponse.json({ error: 'Planner se nepodařilo načíst nebo uložit. Zkuste to znovu.' }, { status: 500 });
    }
  })();
}
