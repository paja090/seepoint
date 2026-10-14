import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { taskForEdit, saveFieldTask } from '@/lib/election-removal/tasks';
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireElectionRemovalAccess(true); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  try {
    const { id } = await params; const point = await taskForEdit(id);
    if (!point) throw new Error('Práce nebyla nalezena.');
    return NextResponse.json({ point: await saveFieldTask(point.campaignId, { ...point, deliveryMinutes: point.steps.find(s => s.kind === 'DELIVERY')?.serviceMinutes, ...await req.json() }, auth.user, id) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Zápis selhal.' }, { status: 409 }); }
}
export async function DELETE() {
  return NextResponse.json({ error: 'Historii práce nelze smazat. Použijte zrušení nepřiřazeného zadání.' }, { status: 409 });
}
