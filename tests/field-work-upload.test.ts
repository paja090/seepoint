/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runWithTenantContext } from '../lib/tenant-context';

test('actual field photo upload associates phase and step; retry saves once; stale assignment rejects before storage',async()=>{
  let storageCalls=0; const photos:any[]=[]; const audits:any[]=[];
  const step:any={id:'step',pointId:'point',organizationId:'org',assignedFieldPlanId:'plan',assignedCrewId:'crew',photoType:'AFTER_INSTALLATION'};
  const point={id:'point',organizationId:'org',status:'ASSIGNED',steps:[step]};
  const plan={id:'plan',date:new Date().toISOString().slice(0,10),status:'APPROVED',planningInputSnapshot:{jobs:[],profile:{timezone:'UTC'}},planningSummary:{crews:[{id:'crew',employeeIds:['employee'],stops:[{jobId:'field-step:step',electionRemovalPointId:'point',fieldWorkStepId:'step'}]}]}};
  const tx:any={
    organization:{findUnique:async()=>({plan:'BUSINESS',enabledModules:{navigation:false,electionRemoval:true}})},
    fieldPlan:{findUnique:async({where}:any)=>where.id==='plan'&&where.organizationId==='org'?plan:null,findFirst:async()=>plan},
    employee:{findFirst:async()=>({id:'employee',userId:'worker',isActive:true})},
    electionRemovalPoint:{findFirst:async()=>point},
    photo:{findUnique:async({where}:any)=>photos.find(p=>p.id===where.id&&p.organizationId===where.organizationId),create:async({data}:any)=>{photos.push(data);return data;}},
    crmAuditLog:{create:async({data}:any)=>{audits.push(data);return data;}},
  };
  const db={...tx,$transaction:async(fn:any,opts:any)=>{assert.equal(opts.isolationLevel,'Serializable');return fn(tx);}};
  const keys=[require.resolve('../lib/db'),require.resolve('../lib/storage/photo-storage')]; const old=keys.map(k=>require.cache[k]);
  require.cache[keys[0]]={exports:{prisma:db}} as any;
  require.cache[keys[1]]={exports:{storeTenantPhoto:async({file}:any)=>{storageCalls++;const bytes=Buffer.from(await file.arrayBuffer());return {storageProvider:'DATABASE',bytes,storageKey:'test-key',driveFileId:null,contentChecksum:createHash('sha256').update(bytes).digest('hex')};}}} as any;
  try {
    const {uploadFieldPhoto}=require('../lib/election-removal/photo-upload');
    const f=new FormData();f.set('planId','plan');f.set('jobId','field-step:step');f.set('requestKey','upload-key-123');
    f.set('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX3sAAAAASUVORK5CYII=','base64')],'step.png',{type:'image/png'}));
    const run=()=>runWithTenantContext({organizationId:'org',source:'test'},()=>uploadFieldPhoto(f,{id:'worker',email:'worker@example.test',role:'WORKER'}));
    await run();await run();assert.equal(photos.length,1);assert.equal(storageCalls,1);assert.equal(audits.length,1);
    assert.equal(photos[0].fieldWorkStepId,'step');assert.equal(photos[0].electionRemovalPointId,'point');assert.equal(photos[0].type,'AFTER_INSTALLATION');
    step.assignedFieldPlanId='new-plan';await assert.rejects(run(),/FORBIDDEN/);assert.equal(storageCalls,1);
  } finally {keys.forEach((k,i)=>{if(old[i])require.cache[k]=old[i];else delete require.cache[k];});}
});
