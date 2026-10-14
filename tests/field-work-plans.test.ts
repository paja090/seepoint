/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import { myRoute } from '../lib/field-planning/execution';
import { approveFieldDraft } from '../lib/election-removal/approval';
import { convertElectionPointToJob } from '../lib/election-removal/planning';
import { planFieldWork } from '../lib/field-planning/planning-engine';
import { parseProfile } from '../lib/field-planning/profile';
import { hash } from '../lib/field-planning/service';
import { runWithTenantContext } from '../lib/tenant-context';
import { input, travel } from './helpers/field-work';

function fixture() {
  const profile = { ...input([]).profile, vehicleRequired: false };
  const campaign = { id:'campaign', name:'Shared action', targetDate:new Date('2026-10-20'), createdAt:new Date('2026-10-01'), description:'Společné instrukce' };
  const employees = ['a','b'].map(id=>({id,userId:'user-'+id,organizationId:'org',firstName:id,lastName:'Worker',role:'WORKER',roles:[],positions:[],position:null,isActive:true,startDate:null,endDate:null}));
  const points: any[] = ['a','b'].map(id=>({id,organizationId:'org',campaignId:'campaign',campaign,label:id,mediaType:'ACKO',objectType:'Object',quantity:1,latitude:50,longitude:14,
    operationType:'INSPECTION',materialDisposition:'LEAVE',requiredWorkers:1,requiredPositions:[],requiredEquipment:[],reviewRequired:false,assignedFieldPlanId:null,assignedCrewId:null,
    status:'PENDING',updatedAt:new Date('2026-10-01'),startedAt:null,completedAt:null,steps:[{id:'step-'+id,sequence:1,pointId:id,organizationId:'org',kind:'WORK',label:id,
      latitude:50,longitude:14,serviceMinutes:10,quantity:1,completedQuantity:0,loadDelta:0,status:'PENDING',startedAt:null,assignedFieldPlanId:null,assignedCrewId:null,updatedAt:new Date('2026-10-01'),version:0}]}));
  const plans:any[]=[];
  const matches=(row:any,w:any):boolean=>Object.entries(w).every(([k,v]:any)=>k==='OR'?v.some((c:any)=>matches(row,c)):v&&typeof v==='object'&&!Array.isArray(v)&&!(v instanceof Date)?
    ('in' in v?v.in.includes(row[k]):'notIn' in v?!v.notIn.includes(row[k]):'not' in v?row[k]!==v.not:'gt' in v?row[k]>v.gt:matches(row[k],v)):row[k]===v);
  const update=(row:any,data:any)=>Object.entries(data).forEach(([k,v]:any)=>{row[k]=v&&typeof v==='object'&&'increment' in v?row[k]+v.increment:v;});
  const allSteps=()=>points.flatMap(p=>p.steps);
  const tx:any={
    organization:{findUnique:async()=>({plan:'ENTERPRISE',enabledModules:{navigation:false}})},
    organizationFieldPlanningProfile:{findUnique:async()=>({configuration:profile})},
    employee:{findMany:async()=>employees,findFirst:async({where}:any)=>employees.find(e=>e.userId===where.userId)},
    employeeAbsence:{findMany:async()=>[]},vehicle:{findMany:async()=>[]},vehicleReservation:{findMany:async()=>[],updateMany:async()=>({count:0})},workTask:{findMany:async()=>[]},
    workOrder:{findMany:async()=>[]},
    fieldPlan:{findFirst:async({where}:any)=>plans.find(p=>matches(p,where)),findMany:async({where}:any)=>plans.filter(p=>matches(p,where)),
      findUnique:async({where}:any)=>plans.find(p=>matches(p,where)),findUniqueOrThrow:async({where}:any)=>plans.find(p=>matches(p,where)),
      update:async({where,data}:any)=>{const p=plans.find(p=>matches(p,where));update(p,data);return p;},
      updateMany:async({where,data}:any)=>{const rows=plans.filter(p=>matches(p,where));rows.forEach(p=>update(p,data));return {count:rows.length};}},
    electionCampaign:{findFirst:async({where}:any)=>where.organizationId==='org'?campaign:null,update:async()=>campaign},
    electionRemovalPoint:{findMany:async({where}:any)=>points.filter(p=>matches(p,where)),
      update:async({where,data}:any)=>{const p=points.find(p=>matches(p,where));update(p,data);return p;},
      updateMany:async({where,data}:any)=>{const rows=points.filter(p=>matches(p,where));rows.forEach(p=>update(p,data));return {count:rows.length};}},
    fieldWorkStep:{count:async({where}:any)=>allSteps().filter(s=>matches(s,where)).length,
      updateMany:async({where,data}:any)=>{const rows=allSteps().filter(s=>matches(s,where));rows.forEach(s=>update(s,data));return {count:rows.length};}},
    crmAuditLog:{findMany:async()=>[],create:async()=>({})},
  };
  const db:any={...tx,$transaction:async(fn:any,options:any)=>{assert.equal(options.isolationLevel,'Serializable');return fn(tx);}};
  async function draft(id:string,pointId:string,employeeId:string,parentPlanId?:string) {
    const i={...input([convertElectionPointToJob(points.find(p=>p.id===pointId),campaign)]),profile,vehicles:[],
      employees:employees.map(e=>({id:e.id,organizationId:'org',name:`${e.firstName} ${e.lastName}`,userId:e.userId,isActive:true,roles:['WORKER'],positions:[],available:true})),
      crews:[{id:'crew-'+employeeId,employeeIds:[employeeId],vehicleId:null}]};
    const result=await planFieldWork(i,travel);
    plans.push({id,organizationId:'org',date:i.date,version:plans.length+1,electionCampaignId:'campaign',parentPlanId,status:'DRAFT',planningInputSnapshot:i,planningSummary:result,approvalSnapshot:{profileHash:hash(parseProfile(profile))}});
    return i;
  }
  const manager={id:'manager',email:'manager@example.test',role:'MANAGER'};
  const approve=(id:string,i:any)=>runWithTenantContext({organizationId:'org',source:'test'},()=>approveFieldDraft('campaign',i,manager,id,db));
  return {db,plans,points,draft,approve};
}

test('production approval preserves two trips of one campaign; My route shows both to their assigned workers',async()=>{
  const f=fixture();const a=await f.draft('plan-a','a','a');const b=await f.draft('plan-b','b','b');
  await f.approve('plan-a',a);await f.approve('plan-b',b);await f.approve('plan-b',b);
  assert.deepEqual(f.plans.map(p=>p.status),['APPROVED','APPROVED']);assert.equal(f.plans.length,2);
  for(const worker of ['a','b']) {
    const route=await runWithTenantContext({organizationId:'org',source:'test'},()=>myRoute('user-'+worker,'2026-10-20',f.db));
    assert.equal(route.routes.length,1);assert.equal(route.routes[0].planId,'plan-'+worker);assert.equal(route.routes[0].stops[0].electionRemovalPointId,worker);
  }
  const revision=await f.draft('plan-a2','a','a','plan-a');await f.approve('plan-a2',revision);
  assert.deepEqual(f.plans.map(p=>p.status),['SUPERSEDED','APPROVED','APPROVED']);
});
test('production approval rejects stale task and foreign tenant before assignments',async()=>{
  const f=fixture();const a=await f.draft('plan-a','a','a');f.points[0].quantity=99;
  await assert.rejects(f.approve('plan-a',a),/změnilo/);assert.equal(f.plans[0].status,'DRAFT');
  await assert.rejects(runWithTenantContext({organizationId:'foreign',source:'test'},()=>approveFieldDraft('campaign',a,{id:'m',email:'m@test',role:'MANAGER'},'plan-a',f.db)),/Návrh/);
});
