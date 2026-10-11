import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { recordCrewLocation } from '@/lib/field-planning/live-location';

export async function POST(request: Request) {
  const user = await requireApiAccess('myTasks', 'workRoute');
  if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });

  try {
    const input = await request.json();
    const result = await recordCrewLocation(input, user);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Uložení polohy selhalo.';
    return NextResponse.json(
      { error: message },
      { status: message.startsWith('FORBIDDEN') ? 403 : 400 }
    );
  }
}
