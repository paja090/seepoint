import type { PlanningInput, PlanningResult } from '../field-planning/contracts';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { plannerTransaction, requirePlannerManager, hash, json, auditPlan, type PlannerActor } from '../field-planning/service';
import { fieldAvailability } from './availability';
import { convertElectionPointToJob } from './planning';
import { createVehicleReservation } from '../vehicle-reservation-service';
import { loadProfile } from '../field-planning/data';

export async function persistFieldDraft(campaignId: string, input: PlanningInput, result: PlanningResult, parentPlanId?: string) {
  const { organizationId, userId } = requireTenantContext();
  const requestHash = hash({ input, parentPlanId });
  return plannerTransaction(async tx => {
    const profileHash = hash(await loadProfile(tx));
    const duplicate = await tx.fieldPlan.findUnique({ where: { organizationId_requestKey: { organizationId, requestKey: 'field-' + requestHash } } });
    if (duplicate) return duplicate;
    const latest = await tx.fieldPlan.findFirst({ where: { organizationId, date: input.date }, orderBy: { version: 'desc' } });
    return tx.fieldPlan.create({ data: { organizationId, date: input.date, version: (latest?.version ?? 0) + 1,
      requestKey: 'field-' + requestHash, requestHash, electionCampaignId: campaignId, parentPlanId,
      createdByUserId: userId || 'system', approvalSnapshot: json({ profileHash }), planningInputSnapshot: json(input), planningSummary: json(result) } });
  });
}

export async function approveFieldDraft(campaignId: string, suppliedInput: PlanningInput, actor: PlannerActor, draftId?: string, db = prisma) {
  requirePlannerManager(actor);
  const { organizationId } = requireTenantContext();
  return plannerTransaction(async tx => {
    // Legacy clients identify the server proposal by its exact input hash. No client result is persisted.
    const row = draftId ? await tx.fieldPlan.findFirst({ where: { id: draftId, organizationId } })
      : (await tx.fieldPlan.findUnique({ where: { organizationId_requestKey: { organizationId, requestKey: 'field-' + hash({ input: suppliedInput }) } } }))
      ?? (await tx.fieldPlan.findFirst({ where: { organizationId, electionCampaignId: campaignId, status: 'DRAFT', date: suppliedInput.date }, orderBy: { createdAt: 'desc' } }));
    if (!row || row.electionCampaignId !== campaignId) throw new Error('Návrh nebyl vytvořen serverem. Přepočítejte jej.');
    if (['APPROVED', 'ACTIVE', 'COMPLETED'].includes(row.status)) return row;
    if (row.status !== 'DRAFT') throw new Error('Návrh již není platný.');
    if ((row.approvalSnapshot as { profileHash?: string } | null)?.profileHash !== hash(await loadProfile(tx))) throw new Error('Nastavení plánování se změnilo. Přepočítejte návrh.');
    const input = row.planningInputSnapshot as unknown as PlanningInput;
    const result = row.planningSummary as unknown as PlanningResult;
    if (!result.crews.some(c => c.stops.some(s => s.fieldWorkStepId)) || result.conflicts.length) throw new Error('Návrh musí obsahovat naplánovanou práci bez konfliktů posádek a vozidel.');
    // Unassigned jobs remain in the backlog; validate only the proposed work.
    const assignedPointIds = new Set(result.crews.flatMap(c => c.stops.flatMap(s => s.electionRemovalPointId ? [s.electionRemovalPointId] : [])));
    const assignedJobs = input.jobs.filter(j => j.electionRemovalPointId && assignedPointIds.has(j.electionRemovalPointId));
    const campaign = await tx.electionCampaign.findFirst({ where: { id: campaignId, organizationId } });
    if (!campaign) throw new Error('Akce nebyla nalezena.');
    const parent = row.parentPlanId ? await tx.fieldPlan.findFirst({ where: { id: row.parentPlanId, organizationId, electionCampaignId: campaignId } }) : null;
    if (row.parentPlanId && (!parent || !['APPROVED', 'ACTIVE', 'DRAFT'].includes(parent.status))) throw new Error('Nahrazovaný výjezd není dostupný.');
    if (parent && await tx.fieldWorkStep.count({ where: { organizationId, assignedFieldPlanId: parent.id, status: { notIn: ['COMPLETED', 'CANCELLED'] }, OR: [{ status: 'ISSUE' }, { startedAt: { not: null } }, { completedQuantity: { gt: 0 } }, { kind: { in: ['DELIVERY', 'HANDOFF'] }, point: { steps: { some: { loadDelta: { gt: 0 }, completedQuantity: { gt: 0 } } } } }] } })) throw new Error('Ve výjezdu zbývá rozpracovaná práce. V detailu akce ji nejprve uvolněte tlačítkem „Uvolnit pro novou trasu“, nebo předejte naložený materiál.');
    const points = await tx.electionRemovalPoint.findMany({ where: { organizationId, campaignId, id: { in: [...assignedPointIds] } }, include: { steps: { orderBy: { sequence: 'asc' } } } });
    if (points.length !== assignedJobs.length || assignedJobs.some(j => {
      const point = points.find(p => p.id === j.electionRemovalPointId);
      return !point || hash(convertElectionPointToJob(point, campaign)) !== hash(j) || (point.assignedFieldPlanId && point.assignedFieldPlanId !== parent?.id);
    })) throw new Error('Zadání nebo přiřazení se od návrhu změnilo. Přepočítejte plán.');
    const current = await fieldAvailability(tx, organizationId, row.date, parent?.id, input.profile.timezone);
    for (const crew of result.crews) {
      if (crew.employeeIds.some(id => !current.employees.some(e => e.id === id && e.available))) throw new Error('Pracovník již není dostupný.');
      const vehicle = current.vehicles.find(v => v.id === crew.vehicleId);
      if (crew.vehicleId && (!vehicle || vehicle.reserved || ['SERVICE', 'OUT_OF_SERVICE', 'IN_USE'].includes(vehicle.status) || hash(vehicle) !== hash(input.vehicles.find(v => v.id === crew.vehicleId)))) throw new Error('Vozidlo nebo jeho kapacita se změnily.');
      if (crew.employeeIds.some(id => hash(current.employees.find(e => e.id === id)) !== hash(input.employees.find(e => e.id === id)))) throw new Error('Požadavky na pracovníky se změnily.');
    }
    if (parent) {
      await tx.fieldPlan.update({ where: { id: parent.id, organizationId }, data: { status: await tx.fieldWorkStep.count({ where: { organizationId, assignedFieldPlanId: parent.id, status: 'COMPLETED' } }) ? 'COMPLETED' : 'SUPERSEDED' } });
      await tx.fieldWorkStep.updateMany({ where: { organizationId, assignedFieldPlanId: parent.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, data: { assignedFieldPlanId: null, assignedCrewId: null, status: 'PENDING', version: { increment: 1 } } });
      await tx.electionRemovalPoint.updateMany({ where: { organizationId, assignedFieldPlanId: parent.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, data: { assignedFieldPlanId: null, assignedCrewId: null, status: 'PENDING' } });
      const oldReservations = (parent.approvalSnapshot as { reservationIds?: string[] } | null)?.reservationIds ?? [];
      await tx.vehicleReservation.updateMany({ where: { organizationId, id: { in: oldReservations } }, data: { status: 'CANCELLED' } });
    }
    const reservationIds: string[] = [];
    for (const crew of result.crews) {
      for (const stop of crew.stops) {
        if (!stop.electionRemovalPointId || !stop.fieldWorkStepId) continue;
        const claimed = await tx.fieldWorkStep.updateMany({ where: { id: stop.fieldWorkStepId, organizationId, pointId: stop.electionRemovalPointId, assignedFieldPlanId: null, status: 'PENDING' },
          data: { assignedFieldPlanId: row.id, assignedCrewId: crew.id, status: 'ASSIGNED', version: { increment: 1 } } });
        if (claimed.count !== 1) throw new Error('Krok již přiřadil jiný dispečer.');
        await tx.electionRemovalPoint.update({ where: { id: stop.electionRemovalPointId, organizationId }, data: { assignedFieldPlanId: row.id, assignedCrewId: crew.id, plannedArrivalAt: new Date(stop.arrivalAt), plannedOrder: stop.routeOrder, status: 'ASSIGNED' } });
      }
      if (crew.vehicleId) {
        const reservation = await createVehicleReservation(tx, { id: 'field-' + hash([row.id, crew.id]).slice(0, 32), vehicleId: crew.vehicleId,
          employeeId: crew.employeeIds[0], dateFrom: new Date(`${row.date}T00:00:00Z`), dateTo: new Date(`${row.date}T00:00:00Z`), purpose: `Terénní práce ${row.id}` });
        reservationIds.push(reservation.id);
      }
    }
    const claimed = await tx.fieldPlan.updateMany({ where: { id: row.id, organizationId, status: 'DRAFT' }, data: { status: 'APPROVED', approvedByUserId: actor.id, approvedAt: new Date(), approvalSnapshot: json({ reservationIds }) } });
    if (claimed.count !== 1) throw new Error('Návrh se mezitím změnil.');
    await tx.electionCampaign.update({ where: { id: campaignId, organizationId }, data: { status: 'PLANNED' } });
    await auditPlan(tx, row.id, actor, 'FIELD_PLAN_APPROVED', { supersededPlanId: parent?.id, reservationIds });
    return tx.fieldPlan.findUniqueOrThrow({ where: { id: row.id, organizationId } });
  }, db);
}
