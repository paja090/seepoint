/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseFieldWork } from '../lib/election-removal/release-work';
import { convertElectionPointToJob } from '../lib/election-removal/planning';
import { runWithTenantContext } from '../lib/tenant-context';

function fixture() {
  const start=new Date('2026-10-19T07:00Z');
  const step:any={id:'step',pointId:'point',sequence:1,version:0,status:'ISSUE',kind:'WORK',completedQuantity:2,quantity:5,loadDelta:0,startedAt:start,serviceMinutes:50,latitude:50,longitude:14,assignedFieldPlanId:'old',assignedCrewId:'crew',issueNote:'Rain',updatedAt:start};
  const point:any={id:'point',campaignId:'campaign',organizationId:'org',status:'ISSUE',startedAt:start,assignedFieldPlanId:'old',assignedCrewId:'crew',issueType:'Weather',issueNote:'Rain',steps:[step],quantity:5,mediaType:'OTHER',operationType:'INSPECTION',requiredWorkers:1,requiredPositions:[],requiredEquipment:[],updatedAt:start};
  const events=new Map<string,any>();let closed=false;
  const db:any={
    crmAuditLog:{findUnique:async({where}:any)=>events.get(where.id),create:async({data}:any)=>events.set(data.id,data)},
    electionRemovalPoint:{findFirst:async({where}:any)=>where.organizationId==='org'?structuredClone(point):null,update:async({data}:any)=>Object.assign(point,data)},
    fieldWorkStep:{updateMany:async({where,data}:any)=>{assert.equal(where.organizationId,'org');const s=point.steps.find((s:any)=>s.id===where.id); if(!s||s.version!==where.version)return {count:0};Object.assign(s,data,{version:s.version+1});return {count:1};}, count:async()=>0},
    fieldPlan:{findFirst:async()=>({id:'old',approvalSnapshot:{reservationIds:['reservation']}}),update:async()=>{closed=true;}},
    vehicleReservation:{updateMany:async({where,data}:any)=>{assert.deepEqual(where.id.in,['reservation']);assert.equal(data.status,'CANCELLED');}},
  };
  const input={pointId:'point',note:'Continue tomorrow; no material in vehicle',requestKey:'release-request',confirmed:true};
  const run=(role='MANAGER',org='org')=>runWithTenantContext({organizationId:org,source:'test'},()=>releaseFieldWork(db,input,{id:'manager',email:'m@test',role}));
  return {point,step,events,input,run,closed:()=>closed};
}

test('release preserves quantities and history, resolves reported issue and plans only remaining work',async()=>{
  const f=fixture(); const started=f.step.startedAt; await f.run(); await f.run();
  assert.equal(f.events.size,1);assert.equal(f.step.completedQuantity,2);assert.equal(f.step.startedAt,started);
  assert.equal(f.step.assignedFieldPlanId,null);assert.equal(f.point.assignedFieldPlanId,null);assert.equal(f.step.status,'PENDING');assert.equal(f.point.issueNote,null);assert.equal(f.closed(),true);
  assert.equal(JSON.parse([...f.events.values()][0].detailsJson).previousIssueNote,'Rain');
  const job=convertElectionPointToJob(f.point,{id:'campaign',name:'Test',createdAt:new Date(),targetDate:null});
  assert.equal(job.blockedReason,undefined);assert.equal(job.quantity,3);assert.equal(job.serviceMinutes,30);
  f.input.note='Changed request';await assert.rejects(f.run(),/jinému předání/);
});
test('release rejects workers, foreign tenants and missing confirmation',async()=>{
  const f=fixture();await assert.rejects(f.run('WORKER'),/FORBIDDEN/);await assert.rejects(f.run('MANAGER','foreign'),/otevřená/);
  f.input.confirmed=false;await assert.rejects(f.run(),/potvrďte/);assert.equal(f.events.size,0);
});
test('loaded or partially picked-up material must go through physical handoff',async()=>{
  const f=fixture(); f.step.kind='PICKUP';f.step.loadDelta=5;
  await assert.rejects(f.run(),/naložen/);assert.equal(f.step.assignedFieldPlanId,'old');
  f.step.kind='DELIVERY';f.step.loadDelta=-5;f.step.completedQuantity=0;
  await assert.rejects(f.run(),/naložen/);assert.equal(f.events.size,0);
});
