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
  const requestId='dispatch-'+hash([organizationId,body.requestKey]).slice(0,32);
  return plannerTransaction(async tx=>{
    const existing=await tx.crmAuditLog.findFirst({where:{id:requestId,organizationId,action:'DISPATCH_WORK_CREATED'},select:{detailsJson:true}});
    if(existing){
      const saved=JSON.parse(existing.detailsJson ?? '{}') as {requestHash?:string;campaignId:string;pointId:string};
      if(saved.requestHash!==requestHash)throw new Error('Požadavek už byl uložen s jiným zadáním. Obnovte formulář.');
      return {campaignId:saved.campaignId,pointId:saved.pointId};
    }
    // Reuse open intake work for the same client so several tasks can share one route.
    let campaign=await tx.electionCampaign.findFirst({where:{organizationId,clientName:clientName||null,targetDate:null,status:{notIn:['COMPLETED','ARCHIVED','CANCELLED']},mediaDefaults:{path:['dispatchIntake'],equals:true}},orderBy:{createdAt:'desc'},select:{id:true}});
    if(!campaign)campaign=await tx.electionCampaign.create({data:{organizationId,name:clientName?'Práce pro '+clientName:'Průběžná terénní práce',clientName:clientName||null,targetDate:null,status:'DRAFT',totalPoints:0,completedPoints:0,mediaDefaults:{dispatchIntake:true}},select:{id:true}});
    const point=await saveFieldTaskTx(tx,campaign.id,body.task,actor);
    await tx.crmAuditLog.create({data:{id:requestId,organizationId,userId:actor.id,userEmail:actor.email,entityType:'ElectionRemovalPoint',entityId:point.id,action:'DISPATCH_WORK_CREATED',detailsJson:JSON.stringify({requestHash,campaignId:campaign.id,pointId:point.id})}});
    return {campaignId:campaign.id,pointId:point.id};
  },db);
}
