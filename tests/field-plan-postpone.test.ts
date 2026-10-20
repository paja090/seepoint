/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import { postponeFieldPlan, nextContinuationDay, shiftPlanTime } from '../lib/election-removal/postpone-plan';
import { runWithTenantContext } from '../lib/tenant-context';
function fixture() {
 const leg={distanceMeters:100,durationSeconds:60,estimated:true,polyline:''};
 const stop=(id:string)=>({jobId:id,workOrderId:id,fieldWorkStepId:id,electionRemovalPointId:id,title:id,routeOrder:1,arrivalAt:'2026-10-24T07:00:00Z',startAt:'2026-10-24T07:00:00Z',endAt:'2026-10-24T08:00:00Z',serviceMinutes:60,travel:leg,quantity:5});
 const crew={id:'crew',employeeIds:['employee'],vehicleId:null,names:['Worker'],departureAt:'2026-10-24T06:00:00Z',endAt:'2026-10-24T09:00:00Z',stops:[stop('done'),stop('remaining')],returnLeg:leg};
 const old:any={id:'old',organizationId:'org',date:'2026-10-24',status:'ACTIVE',electionCampaignId:'campaign',planningInputSnapshot:{profile:{timezone:'Europe/Prague'}},planningSummary:{crews:[crew]},approvalSnapshot:{reservationIds:[]}};
 const step:any={id:'remaining',pointId:'remaining',assignedFieldPlanId:'old',assignedCrewId:'crew',version:3,status:'ISSUE',quantity:5,completedQuantity:2,kind:'DELIVERY',issueNote:'Gate closed',startedAt:new Date('2026-10-24T07:00:00Z'),point:{label:'Remaining'}};
 let created:any;const updates:any[]=[];const audits:any[]=[];const absences:any[]=[];
 const db:any={
  $transaction:async(fn:any)=>fn(db),
  fieldPlan:{findUnique:async()=>created,findFirst:async({where}:any)=>where.id?(where.organizationId==='org'?old:null):null,findMany:async()=>[],create:async({data}:any)=>created={id:'new',...data},update:async({where,data}:any)=>{updates.push({where,data});return data;}},
  fieldWorkStep:{findMany:async({where}:any)=>{assert.deepEqual(where.status.notIn,['COMPLETED','CANCELLED']);return [structuredClone(step)];},updateMany:async({where,data}:any)=>{assert.equal(where.version,3);assert.equal(where.organizationId,'org');Object.assign(step,data,{version:4});return {count:1};}},
  electionRemovalPoint:{update:async({data}:any)=>{updates.push(data);}},
  crmAuditLog:{findMany:async()=>[],create:async({data}:any)=>audits.push(data)},
  employee:{findMany:async()=>[{id:'employee',isActive:true,roles:[],positions:[]}]},employeeAbsence:{findMany:async()=>absences},vehicle:{findMany:async()=>[]},vehicleReservation:{findMany:async()=>[],updateMany:async()=>({count:0})},workTask:{findMany:async()=>[]},
 };
 const run=(role='MANAGER',organizationId='org')=>runWithTenantContext({organizationId,source:'test'},()=>postponeFieldPlan('old',{id:'manager',email:'manager@test',role},db,new Date('2026-10-24T17:00:00Z')));
 return {run,step,old,absences,updates,audits,created:()=>created};
}
test('next day uses today for overdue routes and preserves local times across DST',()=>{
 assert.equal(nextContinuationDay('2026-10-19','Europe/Prague',new Date('2026-10-24T17:00Z')),'2026-10-25');
 assert.equal(nextContinuationDay('2026-10-29','Europe/Prague',new Date('2026-10-24T17:00Z')),'2026-10-30');
 assert.equal(shiftPlanTime('2026-10-24T07:00:00Z','2026-10-24','2026-10-25','Europe/Prague'),'2026-10-25T08:00:00.000Z');
});
test('continue moves only unfinished work, preserves partial completion, issues and material custody; retry is idempotent',async()=>{
 const f=fixture();const first=await f.run();assert.deepEqual(first,{id:'new',date:'2026-10-25'});assert.deepEqual(await f.run(),first);
 assert.equal(f.step.assignedFieldPlanId,'new');assert.equal(f.step.completedQuantity,2);assert.equal(f.step.status,'ISSUE');assert.equal(f.step.issueNote,'Gate closed');assert.equal(f.step.kind,'DELIVERY');
 const crew=f.created().planningSummary.crews[0];assert.deepEqual(crew.stops.map((s:any)=>s.fieldWorkStepId),['remaining']);assert.equal(crew.stops[0].quantity,3);assert.equal(crew.stops[0].startAt,'2026-10-25T08:00:00.000Z');assert.deepEqual(crew.employeeIds,['employee']);
 assert.equal(f.audits.length,2);assert.ok(f.updates.some(u=>u.where?.id==='old'&&u.data.status==='COMPLETED'));
});
test('conflicting crew, deadlines and stale assignments reject before changing data',async()=>{
 const f=fixture();f.absences.push({employeeId:'employee'});await assert.rejects(f.run(),/absenci/);assert.equal(f.created(),undefined);
 const deadline=fixture();deadline.step.point.deadlineAt=new Date('2026-10-24T20:00Z');await assert.rejects(deadline.run(),/pevný termín/);assert.equal(deadline.created(),undefined);
 const stale=fixture();stale.step.assignedCrewId='other';await assert.rejects(stale.run(),/hotové|změnilo/);assert.equal(stale.created(),undefined);
});
test('workers and foreign organizations cannot continue a plan',async()=>{
 const f=fixture();await assert.rejects(f.run('WORKER'),/FORBIDDEN/);await assert.rejects(f.run('MANAGER','foreign'),/schválenou/);assert.equal(f.created(),undefined);
});
