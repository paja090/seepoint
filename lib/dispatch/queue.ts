import type { PlanningJob, PlanningResult } from '../field-planning/contracts';
import { planningStopHref } from '../field-planning/presentation';

export type DispatchItem = { id: string; title: string; client: string; address: string; source: 'work' | 'navigation' | 'field'; campaignId?: string; pointId?: string; state: 'ready' | 'issue' | 'planned'; reason: string; detailUrl: string; planId?: string; quantity: number };
export type DispatchPlan = { id: string; date: string; status: string; electionCampaignId: string | null; version: number; planningSummary: unknown };
export function dispatchQueue(jobs: PlanningJob[], plans: DispatchPlan[], fieldAssignments: Record<string,string> = {}): DispatchItem[] {
  const assigned = new Map(Object.entries(fieldAssignments));
  for(const plan of plans.filter(p => ['APPROVED','ACTIVE'].includes(p.status))) {
    const result = (plan.planningSummary ?? {}) as PlanningResult;
    for(const crew of result.crews ?? []) for(const stop of crew.stops ?? []) {
      if(!stop.isWarehousePitstop) assigned.set(stop.jobId ?? stop.workOrderId, plan.id);
    }
  }
  const unique = new Map<string,DispatchItem>();
  for(const job of jobs) {
    if(['DONE','CANCELLED'].includes(job.status)) continue;
    const planId = assigned.get(job.id) ?? (job.parentWorkOrderId ? assigned.get(job.parentWorkOrderId) : undefined);
    const source = job.electionCampaignId ? 'field' : job.navigationPointId ? 'navigation' : 'work';
    unique.set(job.id,{id:job.id,title:job.title,client:job.clientName ?? '',address:job.address ?? '',source,campaignId:job.electionCampaignId,pointId:job.electionRemovalPointId,state:job.status==='ISSUE'?'issue':planId?'planned':job.blockedReason?'issue':'ready',reason:job.blockedReason ?? '',detailUrl:planningStopHref({...job,workOrderId:job.parentWorkOrderId ?? (source==='work'?job.id:'')}) ?? '/work',planId,quantity:job.quantity ?? 1});
  }
  return [...unique.values()];
}
export function dispatchPlanningLinks(items: DispatchItem[], date: string) {
  const groups = new Map<string,DispatchItem[]>();
  for(const item of items.filter(i=>i.state==='ready')) {
    const key = item.campaignId ?? 'standard';groups.set(key,[...(groups.get(key)??[]),item]);
  }
  return [...groups.entries()].flatMap(([key,allRows])=>Array.from({length:Math.ceil(allRows.length/100)},(_,part)=>{
    const rows=allRows.slice(part*100,(part+1)*100);
    const params=new URLSearchParams({date});
    if(key==='standard'){params.set('planner','work');params.set('jobs',rows.map(r=>r.id).join(','));}
    else {params.set('campaign',key);params.set('points',rows.map(r=>r.pointId).filter(Boolean).join(','));}
    return {key:key+':'+part,count:rows.length,label:(key==='standard'?'Montáže a navigace':rows[0].client || rows[0].title)+(allRows.length>100?' — část '+(part+1):''),url:'/work/dispatch?'+params.toString()+'#planner'};
  }));
}
