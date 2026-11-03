import type { Prisma } from '@prisma/client';
import { requireTenantContext } from '../tenant-context';
import { isModuleEnabled } from '../organization-modules';
import { convertElectionPointToJob } from '../election-removal/planning-job';
export const isFieldJobId=(id:string)=>id.startsWith('field-step:')||id.startsWith('election-point:');
export async function requireFieldJobsEnabled(db:Prisma.TransactionClient) {
  const {organizationId}=requireTenantContext();
  const organization=await db.organization.findUnique({where:{id:organizationId},select:{plan:true,enabledModules:true}});
  if(!isModuleEnabled(organization,'electionRemoval'))throw new Error('FORBIDDEN: Terénní práce nejsou aktivní.');
}
export async function loadFieldJobs(
  db: Prisma.TransactionClient,
  jobIds?: string[],
  options: { excludePlanIds?: string[]; campaignIds?: string[] } = {}
) {
  const { organizationId } = requireTenantContext();
  await requireFieldJobsEnabled(db);
  const selected = jobIds?.filter(isFieldJobId);
  const hasSelected = Boolean(selected && selected.length > 0);
  const campaignIds = options.campaignIds?.filter(Boolean) ?? [];
  if (jobIds !== undefined && !hasSelected && campaignIds.length === 0) return [];

  const orClauses: Prisma.ElectionRemovalPointWhereInput[] = [];
  if (hasSelected && selected) {
    const pointIds = selected.filter(id => id.startsWith('election-point:')).map(id => id.slice(15));
    const stepIds = selected.filter(id => id.startsWith('field-step:')).map(id => id.slice(11));
    if (pointIds.length > 0) orClauses.push({ id: { in: pointIds } });
    if (stepIds.length > 0) orClauses.push({ steps: { some: { id: { in: stepIds }, organizationId } } });
  }
  if (campaignIds.length > 0) {
    orClauses.push({ campaignId: { in: campaignIds }, status: { notIn: ['COMPLETED', 'CANCELLED'] } });
  }

  const points = await db.electionRemovalPoint.findMany({
    where: {
      organizationId,
      campaign: { organizationId, status: { notIn: ['ARCHIVED', 'CANCELLED'] } },
      ...(orClauses.length > 0 ? { OR: orClauses } : { status: { notIn: ['COMPLETED', 'CANCELLED'] } }),
    },
    include: { campaign: true, steps: { orderBy: { sequence: 'asc' } } },
    orderBy: { id: 'asc' },
    take: 201,
  });
  if (points.length > 200) throw new Error('Vyberte nejvýše 200 terénních bodů.');
  const excluded = new Set(options.excludePlanIds ?? []);
  return points.map(point => {
    if (
      point.organizationId !== organizationId ||
      point.campaign.organizationId !== organizationId ||
      point.steps.some(step => step.organizationId !== organizationId || step.pointId !== point.id)
    ) {
      throw new Error('Cross-tenant field reference rejected.');
    }
    const job = convertElectionPointToJob(point, point.campaign);
    const pending = point.steps.filter(step => !['COMPLETED', 'CANCELLED'].includes(step.status));
    const assignedElsewhere =
      Boolean(point.assignedFieldPlanId && !excluded.has(point.assignedFieldPlanId)) ||
      pending.some(step => Boolean(step.assignedFieldPlanId && !excluded.has(step.assignedFieldPlanId)));
    const inProgress = pending.some(
      step =>
        step.status !== 'PENDING' &&
        !(step.status === 'ASSIGNED' && step.assignedFieldPlanId && excluded.has(step.assignedFieldPlanId))
    );
    const blockedReason =
      job.blockedReason ??
      (assignedElsewhere
        ? 'Práce již patří jinému výjezdu.'
        : inProgress
          ? 'Nejdříve uvolněte rozpracovanou práci.'
          : undefined);
    return { ...job, clientName: point.campaign.clientName, address: point.label, blockedReason };
  });
}
