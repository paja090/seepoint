/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server';
import { requireTenantContext } from '../lib/tenant-context';

test('actual action endpoint uses planner transaction, audits creation and skips an empty point import', async () => {
  const audits: any[]=[]; let emptyWrites=0; let role='MANAGER';
  const tx={electionCampaign:{create:async({data}:any)=>{assert.equal(requireTenantContext().organizationId,'org');return {id:'action',...data};}},
    electionRemovalPoint:{createMany:async()=>{emptyWrites++;throw new Error('Empty import must not issue a database operation');}},
    crmAuditLog:{create:async({data}:any)=>{audits.push(data);return data;}}};
  const db={...tx,$transaction:async(fn:any,options:any)=>{assert.equal(options.isolationLevel,'Serializable');assert.equal(options.timeout,30000);return fn(tx);}};
  const keys=[require.resolve('../lib/db'),require.resolve('../lib/election-removal/guard')];const previous=keys.map(k=>require.cache[k]);
  require.cache[keys[0]]={exports:{prisma:db}} as any;
  require.cache[keys[1]]={exports:{requireElectionRemovalAccess:async()=>role==='MANAGER'?{organizationId:'org',user:{id:'manager',email:'manager@example.invalid',role}}:NextResponse.json({error:'Forbidden'},{status:403}),isElectionRemovalAccessDenied:(r:any)=>r instanceof NextResponse}} as any;
  try {
    const {POST}=require('../app/api/election-removal/campaigns/route');
    const call=()=>POST(new Request('http://localhost/api/election-removal/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'New field action',points:[]})})) as Promise<Response>;
    const response=await call();assert.equal(response.status,200);assert.equal((await response.json()).campaignId,'action');
    assert.equal(emptyWrites,0);assert.equal(audits.length,1);assert.equal(audits[0].action,'FIELD_ACTION_CREATED');assert.equal(audits[0].organizationId,'org');
    role='WORKER';assert.equal((await call()).status,403);assert.equal(audits.length,1);
  } finally {keys.forEach((k,i)=>{if(previous[i])require.cache[k]=previous[i];else delete require.cache[k];});}
});
