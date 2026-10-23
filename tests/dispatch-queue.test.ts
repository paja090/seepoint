import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchQueue, dispatchPlanningLinks, type DispatchPlan } from '../lib/dispatch/queue';
import type { PlanningJob } from '../lib/field-planning/contracts';
import { parseTaskSpec, taskSteps } from '../lib/election-removal/task-spec';
const job=(id:string,extra:Partial<PlanningJob>={}):PlanningJob=>({id,organizationId:'a',title:id,workType:'INSTALLATION',priority:'NORMAL',status:'PLANNED',scheduledAt:'2035-06-10T04:00:00Z',updatedAt:'2035-06-01T00:00:00Z',location:{latitude:49,longitude:18},serviceMinutes:20,constraints:{},...extra});
test('queue preserves distinct physical points and excludes finished work',()=>{
 const rows=dispatchQueue([job('a'),job('b'),job('a'),job('done',{status:'DONE'}),job('cancel',{status:'CANCELLED'})],[]);
 assert.deepEqual(rows.map(r=>r.id),['a','b']);
});
test('active assignments and blockers cannot be selected for new proposals',()=>{
 const plans=[{id:'p',date:'2035-06-10',status:'ACTIVE',electionCampaignId:null,version:1,planningSummary:{crews:[{stops:[{jobId:'a',workOrderId:'parent'}]}]}}] as DispatchPlan[];
 const rows=dispatchQueue([job('a'),job('b',{blockedReason:'Chybí GPS'}),job('c')],plans);
 assert.deepEqual(rows.map(r=>r.state),['planned','issue','ready']);
 assert.equal(dispatchPlanningLinks(rows,'2035-06-10')[0].count,1);
 assert.equal(new URL(dispatchPlanningLinks(rows,'2035-06-10')[0].url,'https://test').searchParams.get('jobs'),'c');
});
test('field assignments from another day remain reserved and drafts do not reserve work',()=>{
 const rows=dispatchQueue([job('a'),job('b')],[{id:'draft',date:'2035-06-10',status:'DRAFT',version:1,electionCampaignId:null,planningSummary:null}],{a:'yesterday'});
 assert.deepEqual(rows.map(r=>r.state),['planned','ready']);
 assert.equal(rows[0].planId,'yesterday');
});
test('mixed selections retain canonical source links and split into compatible proposals',()=>{
 const rows=dispatchQueue([job('w'),job('n',{navigationPointId:'np',navigationOrderId:'no'}),job('f',{electionCampaignId:'campaign',electionRemovalPointId:'point'})],[]);
 assert.deepEqual(rows.map(r=>r.detailUrl),['/work/w','/navigation/orders/no','/election-removal/campaign']);
 const links=dispatchPlanningLinks(rows,'2035-06-10');assert.equal(links.length,2);
 assert.equal(new URL(links[0].url,'https://test').searchParams.get('jobs'),'w,n');
 assert.equal(new URL(links[1].url,'https://test').searchParams.get('points'),'point');
});
test('undated intake preserves transport steps, destination confirmation and vehicle load',()=>{
 const raw={label:'Přesun lavičky',operationType:'RELOCATION',mediaType:'BENCH',quantity:2,latitude:49,longitude:18,gpsConfirmed:true,materialDisposition:'TRANSFER',destinationName:'Park',destinationLatitude:49.1,destinationLongitude:18.1,destinationGpsConfirmed:true};
 const spec=parseTaskSpec(raw);assert.equal(spec.deadlineAt,null);const steps=taskSteps(spec);
 assert.deepEqual(steps.map(s=>s.kind),['PICKUP','DELIVERY']);assert.ok(steps[0].loadDelta>0);assert.equal(steps[0].loadDelta+steps[1].loadDelta,0);
 assert.throws(()=>parseTaskSpec({...raw,destinationGpsConfirmed:false}),/GPS/);
});

test('intake retry is idempotent, tenant scoped and rejects changed payload and workers',async()=>{
 const {build}=await import('esbuild');const {createRequire}=await import('node:module');const {resolve}=await import('node:path');const {createHash}=await import('node:crypto');
 let organizationId='a';const rows=new Map<string,Record<string,unknown>>();const audits=new Map<string,{organizationId:string;detailsJson:string}>();let tasks=0;let transactionCount=0;
 const tx={electionCampaign:{findFirst:async({where}:{where:{organizationId:string;clientName:string|null}})=>[...rows.values()].find(r=>r.organizationId===where.organizationId&&r.clientName===where.clientName),create:async({data}:{data:Record<string,unknown>})=>{const row={...data,id:'campaign-'+rows.size};rows.set(row.id,row);return row;}},crmAuditLog:{findFirst:async({where}:{where:{id:string;organizationId:string}})=>{const r=audits.get(where.id);return r?.organizationId===where.organizationId?r:null;},create:async({data}:{data:{id:string;organizationId:string;detailsJson:string}})=>audits.set(data.id,data)}};
 const mocks:Record<string,unknown>={'../db':{prisma:{}},'../tenant-context':{requireTenantContext:()=>({organizationId})},'../field-planning/service':{hash:(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),requirePlannerManager:(actor:{role:string})=>{if(actor.role!=='MANAGER')throw Error('FORBIDDEN');},plannerTransaction:async(fn:(client:typeof tx)=>Promise<unknown>)=>{transactionCount++;return fn(tx);}},'../election-removal/tasks':{saveFieldTaskTx:async()=>({id:'point-'+(++tasks)})}};
 const bundle=await build({entryPoints:['lib/dispatch/intake.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'intake-fixtures',setup(b){b.onResolve({filter:/.*/},args=>args.importer.replaceAll('\\','/').endsWith('/dispatch/intake.ts')&&args.path in mocks?{path:'fixture:'+args.path,external:true}:undefined);}}]});
 const realRequire=createRequire(resolve('package.json'));const evaluated={exports:{} as {createDispatchWork:(raw:unknown,actor:unknown)=>Promise<{campaignId:string}>}};
 new Function('require','module','exports',bundle.outputFiles[0].text)((id:string)=>id.startsWith('fixture:')?mocks[id.slice(8)]:realRequire(id),evaluated,evaluated.exports);
 const payload={requestKey:'request-123',task:{label:'Instalace',operationType:'INSTALL_OBJECT',mediaType:'BENCH',quantity:1,latitude:49,longitude:18,gpsConfirmed:true,materialDisposition:'LEAVE'}};
 const create=(body:unknown=payload,role='MANAGER')=>evaluated.exports.createDispatchWork(body,{role,id:'manager'});
 const first=await create();assert.equal(rows.get(first.campaignId)!.targetDate,null);assert.equal(tasks,1);
 assert.deepEqual(await create(),first);assert.equal(tasks,1);
 await assert.rejects(()=>create({...payload,task:{...payload.task,label:'Jiná'}}),/jiným/);
 await assert.rejects(()=>create(payload,'WORKER'),/FORBIDDEN/);
 const before=transactionCount;await assert.rejects(()=>create({...payload,task:{...payload.task,gpsConfirmed:false}}),/GPS/);assert.equal(transactionCount,before);
 const second=await create({...payload,requestKey:'request-456'});assert.equal(second.campaignId,first.campaignId);assert.equal(tasks,2);assert.equal(rows.size,1);
 organizationId='b';assert.notEqual((await create()).campaignId,first.campaignId);assert.equal(tasks,3);
});

test('reported issue remains visible even when its point belongs to an active route',()=>{
 const [row]=dispatchQueue([job('problem',{status:'ISSUE',blockedReason:'Nelze se dostat na místo'})],[],{problem:'active'});
 assert.equal(row.state,'issue');assert.equal(row.planId,'active');assert.equal(dispatchPlanningLinks([row],'2035-06-10').length,0);
});

test('large selections are split without dropping or repeating work',()=>{
 const links=dispatchPlanningLinks(dispatchQueue(Array.from({length:205},(_,i)=>job('w'+i)),[]),'2035-06-10');
 assert.deepEqual(links.map(l=>l.count),[100,100,5]);
 const ids=links.flatMap(l=>new URL(l.url,'https://test').searchParams.get('jobs')!.split(','));assert.equal(new Set(ids).size,205);
});
