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
export async function loadFieldJobs(db:Prisma.TransactionClient, jobIds?:string[]) {
  const {organizationId}=requireTenantContext();
  await requireFieldJobsEnabled(db);
  const selected=jobIds?.filter(isFieldJobId);
  const points=await db.electionRemovalPoint.findMany({where:{organizationId,campaign:{organizationId,status:{notIn:['ARCHIVED','CANCELLED']}},...(selected?{OR:[{id:{in:selected.filter(id=>id.startsWith('election-point:')).map(id=>id.slice(15))}},{steps:{some:{id:{in:selected.filter(id=>id.startsWith('field-step:')).map(id=>id.slice(11))},organizationId}}}]}:{status:{notIn:['COMPLETED','CANCELLED']}})},include:{campaign:true,steps:{orderBy:{sequence:'asc'}}},orderBy:{id:'asc'},take:201});
  if(points.length>200)throw new Error('Vyberte nejvýše 200 terénních bodů.');
  return points.map(point=>{
    if(point.organizationId!==organizationId||point.campaign.organizationId!==organizationId||point.steps.some(step=>step.organizationId!==organizationId||step.pointId!==point.id))throw new Error('Cross-tenant field reference rejected.');
    const job=convertElectionPointToJob(point,point.campaign);
    const pending=point.steps.filter(step=>!['COMPLETED','CANCELLED'].includes(step.status));
    const blockedReason=job.blockedReason ?? (point.assignedFieldPlanId||pending.some(step=>step.assignedFieldPlanId)?'Práce již patří jinému výjezdu.':pending.some(step=>step.status!=='PENDING')?'Nejdříve uvolněte rozpracovanou práci.':undefined);
    return {...job,clientName:point.campaign.clientName,address:point.label,blockedReason};
  });
}
