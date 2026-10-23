import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { hash, plannerTransaction, requirePlannerManager, type PlannerActor } from '../field-planning/service';
import { parseTaskSpec } from '../election-removal/task-spec';
import { saveFieldTaskTx } from '../election-removal/tasks';

export async function createDispatchWork(raw: unknown, actor: PlannerActor, db=prisma) {
  requirePlannerManager(actor);const {organizationId}=requireTenantContext();
  if(!raw || typeof raw!=='object')throw new Error('Chybí zadání práce.');
  const body=raw as Record<string,unknown>;
  if(typeof body.requestKey!=='string' || !/^[\w-]{8,100}$/.test(body.requestKey))throw new Error('Chybí klíč požadavku. Obnovte formulář.');
  if(body.clientName != null && (typeof body.clientName!=='string' || body.clientName.length>200))throw new Error('Neplatný název klienta.');
  const clientName=typeof body.clientName==='string'?body.clientName.trim():'';
  const spec=parseTaskSpec(body.task);const requestHash=hash({spec:JSON.parse(JSON.stringify(spec)),clientName});
  const id='dispatch-'+hash([organizationId,body.requestKey]).slice(0,32);
  return plannerTransaction(async tx=>{
    const existing=await tx.electionCampaign.findFirst({where:{id,organizationId},select:{id:true,mediaDefaults:true}});
    if(existing){if((existing.mediaDefaults as {dispatchRequestHash?:string}|null)?.dispatchRequestHash!==requestHash)throw new Error('Požadavek už byl uložen s jiným zadáním. Obnovte formulář.');return {campaignId:existing.id};}
    await tx.electionCampaign.create({data:{id,organizationId,name:spec.label,clientName:clientName || null,description:spec.description || null,targetDate:null,status:'DRAFT',totalPoints:0,completedPoints:0,mediaDefaults:{dispatchRequestHash:requestHash}}});
    await saveFieldTaskTx(tx,id,body.task,actor);
    return {campaignId:id};
  },db);
}
