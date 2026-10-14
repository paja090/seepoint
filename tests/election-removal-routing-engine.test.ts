import test from 'node:test';
import assert from 'node:assert/strict';
import type { ElectionRemovalPoint, FieldWorkStep } from '@prisma/client';
import { convertElectionPointToJob } from '../lib/election-removal/planning';
import { parseTaskSpec, taskSteps } from '../lib/election-removal/task-spec';
import { planFieldWork } from '../lib/field-planning/planning-engine';
import { input, travel } from './helpers/field-work';
const campaign={id:'campaign',name:'Field action',targetDate:new Date('2026-10-20T00:00:00Z'),createdAt:new Date('2026-10-01T00:00:00Z')};
function point(id:string,mediaType:string,serviceMinutes:number) {
 const spec=parseTaskSpec({label:id,mediaType,serviceMinutes,operationType:'INSPECTION',materialDisposition:'LEAVE',latitude:50,longitude:14,gpsConfirmed:true,quantity:1});
 return {...spec,id,organizationId:'org',campaignId:campaign.id,status:'PENDING',reviewRequired:false,updatedAt:new Date('2026-10-01'),
   steps:taskSteps(spec).map(s=>({...s,id:'step-'+id,organizationId:'org',pointId:id,status:'PENDING',completedQuantity:0,updatedAt:new Date('2026-10-01')}))} as unknown as ElectionRemovalPoint & {steps:FieldWorkStep[]};
}
test('actual task adapter keeps independent media, quantities, service and IDs at identical GPS',async()=>{
 const jobs=[convertElectionPointToJob(point('a','ACKO',5),campaign),convertElectionPointToJob(point('b','TOWER',15),campaign)];
 assert.notEqual(jobs[0].id,jobs[1].id); assert.equal(jobs[0].serviceMinutes,5);assert.equal(jobs[1].serviceMinutes,15);
 const i=input(jobs);i.profile.routeMode='MIXED';const result=await planFieldWork(i,travel);
 assert.equal(result.unassigned.length,0);assert.equal(result.crews[0].stops.length,2);
 assert.deepEqual(new Set(result.crews[0].stops.map(s=>s.electionRemovalPointId)),new Set(['a','b']));
});
test('legacy unclassified point and unconfirmed destination cannot be silently planned',async()=>{
 const p=point('legacy','ACKO',5);p.operationType=null;p.reviewRequired=true;p.steps=[];
 const result=await planFieldWork(input([convertElectionPointToJob(p,campaign)]),travel);
 assert.equal(result.crews.length,0);assert.match(result.unassigned[0].message,/kontrolu/);
});
