import type { ElectionRemovalPoint, FieldWorkStep } from '@prisma/client';
import { electionRemovalJobId, type PlanningJob } from '../field-planning/contracts';
import { calculateServiceMinutes, calculateMediaLoadSlots } from './constants';

export function convertElectionPointToJob(
  point: ElectionRemovalPoint & { steps?: FieldWorkStep[] },
  campaign: { id: string; name: string; targetDate: Date | null; createdAt: Date }
): PlanningJob {
  const operationType = point.operationType ?? 'OTHER';
  const legacyOperation = operationType === 'REPLACE_AD' || operationType === 'REMOVE_AD' || operationType === 'INSTALL_AD' ? 'BANNER_CHANGE' : operationType === 'RELOCATION' ? 'RELOCATION' : operationType === 'OTHER' ? 'OTHER' : 'FULL_REMOVAL';
  const steps = point.steps?.filter(s => !['COMPLETED', 'CANCELLED'].includes(s.status)).sort((a, b) => a.sequence - b.sequence) ?? [];
  const first = steps[0];
  const delivery = steps[1];

  const calculated = calculateServiceMinutes(point.mediaType, point.quantity, null, legacyOperation);
  const remainingQuantity = point.quantity - (first?.completedQuantity ?? 0);
  const serviceMinutes = first ? Math.max(1, Math.ceil(first.serviceMinutes * remainingQuantity / first.quantity)) : point.serviceMinutes ?? calculated.totalMinutes;
  const loadSlots = first ? Math.max(0, first.loadDelta) : calculateMediaLoadSlots(point.mediaType, legacyOperation, point.quantity);

  return {
    id: first ? `field-step:${first.id}` : electionRemovalJobId(point.id),
    fieldWorkStepId: first?.id,
    delivery: delivery ? { id: delivery.id, title: delivery.label, location: { latitude: delivery.latitude, longitude: delivery.longitude }, serviceMinutes: delivery.serviceMinutes } : undefined,
    sourceType: 'ELECTION_REMOVAL_POINT',
    sourceId: point.id,
    organizationId: point.organizationId,
    title: first?.label ?? `${point.label} (${point.layerName || point.mediaType})`,
    workType: 'ELECTION_REMOVAL',
    priority: 'NORMAL',
    status:
      point.status === 'COMPLETED'
        ? 'DONE'
        : point.status === 'CANCELLED'
        ? 'CANCELLED'
        : 'PLANNED',
    scheduledAt: (campaign.targetDate ?? campaign.createdAt).toISOString(),
    deadlineAt: point.deadlineAt?.toISOString(),
    campaignDateFrom: (campaign.targetDate ?? campaign.createdAt).toISOString(),
    location: {
      latitude: first?.latitude ?? point.latitude,
      longitude: first?.longitude ?? point.longitude,
    },
    serviceMinutes,
    constraints: { windowStart: point.windowStart?.toISOString(), windowEnd: point.windowEnd?.toISOString(), requiredWorkers: point.requiredWorkers, requiredPositions: point.requiredPositions, requiredEquipment: point.requiredEquipment, vehicleRequired: loadSlots > 0 },
    blockedReason:
      point.reviewRequired || !first ? 'Vyžaduje kontrolu: doplňte strukturované zadání a kroky.' : point.startedAt && first.kind !== 'HANDOFF' && !(first.status === 'PENDING' && !first.assignedFieldPlanId) ? 'V detailu akce použijte „Uvolnit pro novou trasu“, nebo předejte naložený materiál.' : point.status === 'ISSUE'
        ? point.issueNote || 'Hlášen problém na stanovišti'
        : undefined,
    updatedAt: point.updatedAt.toISOString() + steps.map(s => '/' + s.updatedAt.toISOString()).join(''),
    electionCampaignId: campaign.id,
    electionRemovalPointId: point.id,
    mediaType: point.mediaType,
    quantity: remainingQuantity,
    operationType,
    loadSlots,
  };
}

