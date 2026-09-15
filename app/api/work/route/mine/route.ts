import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { executeStop, myRoute } from '@/lib/field-planning/execution';
export async function GET() {
  const user = await requireApiAccess('myTasks', 'workRoute'); if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  return NextResponse.json(await myRoute(user.id));
}
export async function POST(request: Request) {
  const user = await requireApiAccess('myTasks', 'workRoute'); if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  try {
    const input = await request.json();
    if (typeof input.planId !== 'string' || typeof input.workOrderId !== 'string' || typeof input.action !== 'string') throw new Error('Neplatný požadavek.');
    return NextResponse.json(await executeStop(input, user));
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Operace selhala.' }, { status: e instanceof Error && e.message.startsWith('FORBIDDEN') ? 403 : 409 }); }
}
