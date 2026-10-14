import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { plannerTransaction, hash } from '@/lib/field-planning/service';
import { coordinates } from '@/lib/field-planning/profile';
export async function POST(req: Request) {
  const auth = await requireElectionRemovalAccess(true); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  try {
    const body = await req.json();
    if (!coordinates({ latitude: body.latitude, longitude: body.longitude }) || body.gpsConfirmed !== true || typeof body.note !== 'string' || !body.note.trim() || body.note.length > 4000 || typeof body.requestKey !== 'string' || !/^[\w-]{8,100}$/.test(body.requestKey)) throw new Error('Potvrďte aktuální GPS materiálu, dosavadního držitele a podmínky předání.');
    await plannerTransaction(async tx => {
      const eventId = 'handoff-' + hash([auth.organizationId, body.pointId, body.requestKey]).slice(0,32);
      const previous = await tx.crmAuditLog.findUnique({ where: { id: eventId, organizationId: auth.organizationId } });
      if (previous) { if (previous.detailsJson !== JSON.stringify(body)) throw new Error('Klíč již patří jinému předání.'); return; }
      const point = await tx.electionRemovalPoint.findFirst({ where: { id: body.pointId, organizationId: auth.organizationId }, include: { steps: { orderBy: { sequence: 'asc' } } } });
      const pending = point?.steps.filter(s => s.status !== 'COMPLETED') ?? [];
      const delivery = pending[0];
      if (!point || pending.length !== 1 || delivery.kind !== 'DELIVERY' || delivery.completedQuantity || delivery.startedAt || !point.steps.some(s => s.status === 'COMPLETED' && s.loadDelta > 0)) throw new Error('Předat lze celý naložený materiál před zahájením doručení. Částečné doručení vyžaduje individuální řešení.');
      await tx.fieldWorkStep.update({ where: { id: delivery.id, organizationId: auth.organizationId }, data: { sequence: delivery.sequence + 1, assignedFieldPlanId: null, assignedCrewId: null, status: 'PENDING', version: { increment: 1 } } });
      await tx.fieldWorkStep.create({ data: { id: 'handoff-step-' + hash(eventId).slice(0,32), organizationId: auth.organizationId, pointId: point.id,
        sequence: delivery.sequence, kind: 'HANDOFF', label: `Převzetí materiálu — ${point.label}`, latitude: body.latitude, longitude: body.longitude,
        quantity: delivery.quantity, serviceMinutes: 10, loadDelta: Math.abs(delivery.loadDelta), photoType: 'CONTROL', custodyNote: body.note.trim() } });
      await tx.electionRemovalPoint.update({ where: { id: point.id, organizationId: auth.organizationId }, data: { assignedFieldPlanId: null, assignedCrewId: null, status: 'PENDING' } });
      await tx.crmAuditLog.create({ data: { id: eventId, organizationId: auth.organizationId, entityType: 'ElectionRemovalPoint', entityId: point.id, userId: auth.user.id, userEmail: auth.user.email, action: 'FIELD_MATERIAL_HANDOFF_REQUESTED', detailsJson: JSON.stringify(body) } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Předání selhalo.' }, { status: 409 }); }
}
