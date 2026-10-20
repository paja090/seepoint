/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import { executeStop } from '../lib/field-planning/execution';
import { fieldStepProblemNotifications } from '../lib/field-planning/notifications';
import { runWithTenantContext } from '../lib/tenant-context';

test('return closes the shift idempotently without completing unfinished steps', async () => {
  const events = new Map<string, any>();
  const plan = {id:'plan', organizationId:'org', status:'ACTIVE', date:'2099-01-01', planningInputSnapshot:{jobs:[],profile:{timezone:'Europe/Prague'}}, planningSummary:{crews:[{id:'crew',employeeIds:['employee'],stops:[{fieldWorkStepId:'unfinished'}]}]}};
  const tx:any = {
    organization:{findUnique:async()=>({plan:"ENTERPRISE",enabledModules:{navigation:false}})},
    fieldPlan:{findFirst:async()=>plan, findUnique:async()=>plan},
    employee:{findFirst:async()=>({id:'employee'})},
    fieldWorkStep:{count:async()=>1,updateMany:async()=>{throw Error('Must not complete unfinished work');}},
    crmAuditLog:{findUnique:async({where}:any)=>events.get(where.id),create:async({data}:any)=>events.set(data.id,data)},
  };
  const db:any = {...tx,$transaction:async(fn:any)=>fn(tx)};
  const run = (userId:string) => runWithTenantContext({organizationId:'org',source:'test'},()=>executeStop({planId:'plan',workOrderId:'',action:'complete_trip'}, {id:userId,email:'w@test',role:'WORKER'},db));
  await run('worker'); await run('worker');
  assert.equal(events.size,1);
  assert.equal([...events.values()][0].action,'FIELD_TRIP_COMPLETED');
  assert.equal(plan.status,'ACTIVE');
  tx.employee.findFirst = async()=>({id:'other'});
  await assert.rejects(run('other'), /FORBIDDEN/);
});

test('dispatcher notifications use unresolved step state with tenant filtering and campaign links', async () => {
  const db:any = {fieldWorkStep:{findMany:async({where}:any)=>{
    assert.equal(where.organizationId,'org'); assert.equal(where.status,'ISSUE');
    assert.equal(where.point.organizationId,'org');
    assert.equal('updatedAt' in where,false); // Older unresolved reports remain visible.
    return [{id:'step',label:'Doručení',issueNote:'Zavřený sklad',updatedAt:new Date('2026-01-01'),point:{label:'Bod 2',campaignId:'campaign',issueType:'Jiné'}}];
  }}};
  const notifications=await fieldStepProblemNotifications('org',db);
  assert.equal(notifications.length,1);
  assert.match(notifications[0].message,/Zavřený sklad/);
  assert.equal(notifications[0].link,'/election-removal/campaign');
});
