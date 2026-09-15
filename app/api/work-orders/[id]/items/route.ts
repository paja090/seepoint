import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { manageWorkItem } from '@/lib/field-planning/manage-items';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('work', 'workRoute'); if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  try { return NextResponse.json(await manageWorkItem((await params).id, await request.json(), user)); }
  catch (e) { const message = e instanceof Error ? e.message : 'Uložení selhalo.'; return NextResponse.json({ error: message }, { status: message.startsWith('FORBIDDEN') ? 403 : 409 }); }
}
