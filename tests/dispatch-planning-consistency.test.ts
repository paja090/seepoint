import test from 'node:test';
import assert from 'node:assert/strict';
import { hasApprovableWork, validateApprovalSelection } from '../lib/field-planning/approval-rules';
import { planningDayOffset, planningStopHref, parseDepotInput } from '../lib/field-planning/presentation';
import { estimatedLeg, planFieldWork } from '../lib/field-planning/planning-engine';
import type { PlanningInput } from '../lib/field-planning/contracts';

function fixture(): PlanningInput {
  return {organizationId:'a',date:'2035-06-10',now:'2035-06-09T10:00:00Z',
    profile:{timezone:'Europe/Prague',country:'CZ',depot:{latitude:49,longitude:18},endLocation:{latitude:49,longitude:18},workdayStart:'06:00',workdayEnd:'14:00',breakMinutes:30,overtimeMinutes:0,strategy:'BALANCED',serviceMinutes:{INSTALLATION:20},fallbackSpeedKph:40,fallbackDistanceFactor:1.4,maximumJobsPerRoute:50,vehicleRequired:false,requireHumanApproval:true,enabled:true},
    jobs:[0,1].map(i=>({id:'w'+i,organizationId:'a',title:'Work '+i,workType:'INSTALLATION',priority:'NORMAL',status:'PLANNED',scheduledAt:'2035-06-10T04:00:00Z',updatedAt:'2035-06-01T00:00:00Z',location:i===0?{latitude:49,longitude:18}:null,serviceMinutes:20,constraints:{}})),
    employees:[{id:'e',organizationId:'a',name:'Worker',userId:'u',isActive:true,available:true,positions:[],roles:['WORKER']}],vehicles:[],crews:[{id:'c',employeeIds:['e'],vehicleId:null}]};
}

test('partial route approves feasible work while missing-GPS work remains unassigned',async()=>{
  const input=fixture();const result=await planFieldWork(input,async(a,b)=>estimatedLeg(a,b,input.profile));
  assert.equal(result.unassigned.length,1);assert.equal(hasApprovableWork(result),true);
  assert.doesNotThrow(()=>validateApprovalSelection(input,result));
  assert.deepEqual(result.crews.flatMap(c=>c.stops.map(s=>s.workOrderId)),['w0']);
  assert.equal(input.jobs[1].status,'PLANNED');
  assert.throws(()=>validateApprovalSelection(input,{...result,conflicts:[{code:'VEHICLE_CONFLICT',message:'Busy'}]}),/konflikt/);
  assert.throws(()=>validateApprovalSelection(input,{...result,crews:[]}),/naplánovanou/);
  input.jobs[0].constraints.predecessorIds=['w1'];
  assert.throws(()=>validateApprovalSelection(input,result),/předchozí/);
  input.jobs[1].status='DONE';assert.doesNotThrow(()=>validateApprovalSelection(input,result));
});

test('links use canonical source and unknown/warehouse stops have no broken work detail',()=>{
  assert.equal(planningStopHref({workOrderId:''}),null);
  assert.equal(planningStopHref({workOrderId:'warehouse-1',isWarehousePitstop:true}),null);
  assert.equal(planningStopHref({electionCampaignId:'c',workOrderId:''}),'/election-removal/c');
  assert.equal(planningStopHref({navigationOrderId:'n',workOrderId:''}),'/navigation/orders/n');
  assert.equal(planningStopHref({workOrderId:'w'}),'/work/w');
  assert.equal(planningStopHref({parentWorkOrderId:'parent'}),'/work/parent');
});

test('today and tomorrow follow organization timezone across midnight and DST',()=>{
  assert.equal(planningDayOffset(new Date('2026-10-22T22:30:00Z'),'Europe/Prague',0),'2026-10-23');
  assert.equal(planningDayOffset(new Date('2026-10-22T01:00:00Z'),'America/New_York',0),'2026-10-21');
  assert.equal(planningDayOffset(new Date('2026-10-24T23:30:00Z'),'Europe/Prague',1),'2026-10-26');
});

test('depot rejects missing/invalid GPS and preserves zero and Czech decimal input',()=>{
  for(const pair of [['',''],['49',''],['abc','18'],['91','18'],['49','181'],['49x','18']])assert.equal(parseDepotInput(...pair as [string,string]),null);
  assert.deepEqual(parseDepotInput('0','0'),{latitude:0,longitude:0});
  assert.deepEqual(parseDepotInput('49,8','18,2'),{latitude:49.8,longitude:18.2});
});


test('approval service persists only assigned work and retry does not duplicate assignments',async()=>{
  const {build}=await import('esbuild');
  const {createRequire}=await import('node:module');
  const {resolve}=await import('node:path');
  const input=fixture();const result=await planFieldWork(input,async(a,b)=>estimatedLeg(a,b,input.profile));
  const row={id:'plan',organizationId:'a',status:'DRAFT',version:1,date:input.date,parentPlanId:null,approvedAt:null as Date|null,planningInputSnapshot:input,planningSummary:result,approvalSnapshot:{}};
  const assignments:string[]=[];const updatedOrders:string[]=[];
  const tx={
    fieldPlan:{findUnique:async()=>row,updateMany:async()=>{row.status='APPROVED';return {count:1};},update:async()=>row},
    workOrder:{findUnique:async()=>({id:'w0',status:'PLANNED',assignments:[]}),update:async({where}:{where:{id:string}})=>{updatedOrders.push(where.id);}},
    workAssignment:{create:async({data}:{data:{workOrderId:string}})=>{assignments.push(data.workOrderId);}},
    crmAuditLog:{create:async()=>({})},
  };
  const mocks:Record<string,unknown>={
    '../db':{prisma:{}},'../tenant-context':{requireTenantContext:()=>({organizationId:'a'})},
    '../work-task-sync':{syncWorkOrderTasks:async()=>{}},'../vehicle-reservation-service':{createVehicleReservation:async()=>{throw Error('Unexpected reservation');}},
    './data':{loadPlanningData:async()=>structuredClone(input),loadProfile:async()=>input.profile},'./capabilities':{navigationAvailable:async()=>true},
  };
  const bundle=await build({entryPoints:['lib/field-planning/service.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'approval-fixtures',setup(b){b.onResolve({filter:/.*/},args=>args.importer.replaceAll('\\','/').endsWith('/field-planning/service.ts')&&args.path in mocks?{path:'fixture:'+args.path,external:true}:undefined);}}]});
  const realRequire=createRequire(resolve('package.json'));
  const evaluated={exports:{} as {approvePlan:(...args:unknown[])=>Promise<{status:string}>}};
  new Function('require','module','exports',bundle.outputFiles[0].text)((id:string)=>id.startsWith('fixture:')?mocks[id.slice(8)]:realRequire(id),evaluated,evaluated.exports);
  const approve=()=>evaluated.exports.approvePlan('plan',{id:'manager',email:'m@example.test',role:'MANAGER'},true,{$transaction:async(fn:(db:typeof tx)=>unknown)=>fn(tx)});
  assert.equal((await approve()).status,'APPROVED');
  assert.deepEqual(updatedOrders,['w0']);assert.deepEqual(assignments,['w0']);
  assert.equal(result.unassigned[0].workOrderId,'w1');
  await approve();assert.deepEqual(assignments,['w0']);
});


test('availability reserves only crews that actually received work',async()=>{
  const {loadPlanningData}=await import('../lib/field-planning/data');
  const {runWithTenantContext}=await import('../lib/tenant-context');
  const input=fixture();
  const empty={findMany:async()=>[]};
  const db={
    organization:{findUnique:async()=>({plan:'PRO',enabledModules:[]})},
    organizationFieldPlanningProfile:{findUnique:async()=>({configuration:input.profile})},
    employee:{findMany:async()=>['assigned','unused'].map(id=>({id,organizationId:'a',firstName:id,lastName:'Worker',userId:null,isActive:true,role:'WORKER',roles:[],positions:[]}))},
    employeeAbsence:empty,vehicle:empty,vehicleReservation:empty,workOrder:empty,workTask:empty,crmAuditLog:empty,navigationOrder:empty,plannerBlock:empty,
    fieldPlan:{findMany:async()=>[{planningInputSnapshot:{crews:[{employeeIds:['assigned']},{employeeIds:['unused']}]},planningSummary:{crews:[{employeeIds:['assigned'],stops:[{workOrderId:'old'}]}]}}]},
  };
  const loaded=await runWithTenantContext({organizationId:'a',source:'test'},()=>loadPlanningData(input.date,{},db as unknown as Parameters<typeof loadPlanningData>[2]));
  assert.equal(loaded.employees.find(e=>e.id==='assigned')?.available,false);
  assert.equal(loaded.employees.find(e=>e.id==='unused')?.available,true);
});


test('partial approval preserves pickup and delivery as one complete transfer',async()=>{
  const input=fixture();input.jobs[0].delivery={id:'delivery',title:'Předání',location:{latitude:49.001,longitude:18},serviceMinutes:10};
  const result=await planFieldWork(input,async(a,b)=>estimatedLeg(a,b,input.profile));
  assert.equal(result.unassigned.length,1);assert.equal(result.crews[0].stops.length,2);
  assert.doesNotThrow(()=>validateApprovalSelection(input,result));
  for(const index of [0,1]){
    const broken=structuredClone(result);broken.crews[0].stops.splice(index,1);
    assert.throws(()=>validateApprovalSelection(input,broken),/vyzvednutí i doručení/);
  }
});
