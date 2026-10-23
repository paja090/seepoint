import { myRoute } from '../field-planning/execution';
import { dispatchProgress, type DispatchProgress } from './presentation';
import { plusDays } from '../planner/time';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { loadPlanningData, loadProfile } from '../field-planning/data';
import { planningDayOffset } from '../field-planning/presentation';
import { zonedTime } from '../field-planning/profile';
import { convertElectionPointToJob } from '../election-removal/planning-job';
import type { PlanningJob } from '../field-planning/contracts';
import { dispatchQueue, type DispatchPlan } from './queue';

export async function loadDispatch(date: string, fieldEnabled: boolean, navigationEnabled: boolean, options: { week?: boolean; userId?: string } = {}) {
  const {organizationId}=requireTenantContext();
  const profile=await loadProfile();const timezone=profile?.timezone ?? 'Europe/Prague';
  const next=planningDayOffset(new Date(zonedTime(date,'12:00',timezone)),timezone,1);
  const messages:string[]=[];
  const [ordinary,points,plans]=await Promise.all([
    profile?.enabled ? loadPlanningData(date).catch(error=>{messages.push(error instanceof Error?error.message:'Pracovní frontu se nepodařilo načíst.');return null;}) : Promise.resolve(null),
    fieldEnabled ? prisma.electionRemovalPoint.findMany({where:{organizationId,status:{notIn:['COMPLETED','CANCELLED']},campaign:{organizationId,status:{notIn:['ARCHIVED','CANCELLED']},OR:[{targetDate:null},{targetDate:{lt:new Date(zonedTime(next,'00:00',timezone))}}]}},include:{campaign:{select:{id:true,name:true,clientName:true,targetDate:true,createdAt:true}},steps:{orderBy:{sequence:'asc'}},assignedFieldPlan:{select:{id:true,status:true}}},orderBy:{createdAt:'asc'},take:501}) : Promise.resolve([]),
    prisma.fieldPlan.findMany({where:{organizationId,date:options.week?{gte:date,lt:plusDays(date,7)}:date,status:{in:['DRAFT','APPROVED','ACTIVE','COMPLETED']},...(!fieldEnabled?{electionCampaignId:null}:{})},select:{id:true,date:true,status:true,electionCampaignId:true,version:true,planningSummary:true},orderBy:{version:'desc'},take:101}),
  ]);
  if(!profile?.enabled) messages.push('Nejdříve potvrďte skutečné depo a zapněte plánování v Nastavení depa.');
  if(points.length>500 || plans.length>100) messages.push('Zobrazeno nejvýše 500 terénních bodů a 100 výjezdů. Další najdete v původních přehledech.');
  const fieldAssignments:Record<string,string>={};
  const jobs:PlanningJob[]=[...(ordinary?.jobs ?? []).filter(job=>navigationEnabled || !job.navigationPointId),...points.slice(0,500).map(point=>{
    const job=convertElectionPointToJob(point,point.campaign);
    if(point.assignedFieldPlan && ['APPROVED','ACTIVE'].includes(point.assignedFieldPlan.status))fieldAssignments[job.id]=point.assignedFieldPlan.id;
    return {...job,...(point.status==='ISSUE'?{status:'ISSUE',blockedReason:point.issueNote||'Hlášen problém na stanovišti'}:{}),clientName:point.campaign.clientName,address:point.label};
  })];
  // Apply the same module filtering as the existing standard planner.
  const visiblePlans=(plans as DispatchPlan[]).slice(0,100).filter(plan=>fieldEnabled || !((plan.planningSummary as {crews?:Array<{stops?:Array<{electionRemovalPointId?:string}>}>}|null)?.crews??[]).some(c=>c.stops?.some(s=>s.electionRemovalPointId))).filter(plan=>navigationEnabled || !((plan.planningSummary as {crews?:Array<{stops?:Array<{navigationPointId?:string}>}>}|null)?.crews ?? []).some(c=>c.stops?.some(s=>s.navigationPointId)));
  let progress: DispatchProgress = {};
  const dayPlans = visiblePlans.filter(plan => plan.date === date);
  const livePlanIds = dayPlans.filter(plan => plan.status !== 'DRAFT').map(plan => plan.id);
  if (options.userId && livePlanIds.length && !options.week) {
    try {
      const execution = await myRoute(options.userId, date, prisma, { allCrews: true, planIds: livePlanIds });
      progress = dispatchProgress(execution.routes);
    } catch {
      messages.push('Průběh realizace se nepodařilo načíst. Obnovte přehled nebo otevřete detail výjezdu.');
    }
  }
  return {items:dispatchQueue(jobs,dayPlans,fieldAssignments),plans:visiblePlans,profile,messages,progress};
}
