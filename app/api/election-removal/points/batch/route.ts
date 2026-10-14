import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { saveFieldTaskTx } from '@/lib/election-removal/tasks';
import { plannerTransaction } from '@/lib/field-planning/service';
export async function PATCH(req: Request) {
  const auth = await requireElectionRemovalAccess(true); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  try { const body = await req.json();
    if (!Array.isArray(body.pointIds) || !body.pointIds.length || body.pointIds.length > 200) throw new Error('Vyberte 1–200 prací.');
    if (!body.changes || typeof body.changes !== 'object' || Object.keys(body.changes).some(k => !['operationType','mediaType','deadlineAt','description','objectType'].includes(k))) throw new Error('Nepovolená hromadná změna.');
    const points = await plannerTransaction(async tx => {
      const rows = await tx.electionRemovalPoint.findMany({ where: { organizationId: auth.organizationId, id: { in: body.pointIds } }, include: { steps: true } });
      if (rows.length !== new Set(body.pointIds).size) throw new Error('Některá práce nebyla nalezena.');
      const result = [];
      for (const p of rows) result.push(await saveFieldTaskTx(tx, p.campaignId, { ...p, deliveryMinutes: p.steps.find(s => s.kind === 'DELIVERY')?.serviceMinutes, ...body.changes, gpsConfirmed: !p.reviewRequired, destinationGpsConfirmed: !p.reviewRequired }, auth.user, p.id));
      return result;
    }); return NextResponse.json({ points });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Hromadná změna selhala.' }, { status: 409 }); }
}
