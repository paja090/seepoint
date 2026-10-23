import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runWithTenantContext } from '../lib/tenant-context';

test('postpone HTTP handler establishes authenticated tenant across async body and service boundaries',async()=>{
 const context=resolve('lib/tenant-context.ts').replaceAll('\\','/');
 const bundle=await build({entryPoints:['app/api/election-removal/plans/postpone/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'route-boundaries',setup(b){
  b.onResolve({filter:/election-removal\/(guard|postpone-plan)$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'ts',resolveDir:process.cwd(),contents:args.path.endsWith('/guard')?
   'export async function requireElectionRemovalAccess(){await Promise.resolve();return {organizationId:"authenticated-org",user:{id:"manager",role:"MANAGER",email:"m@test"}}};export const isElectionRemovalAccessDenied=()=>false;':
   'import {requireTenantContext} from '+JSON.stringify(context)+';export async function postponeFieldPlan(id){await new Promise(r=>setImmediate(r));return {id,date:"2026-10-21",organizationId:requireTenantContext().organizationId};}'}));
 }}]});
 const evaluatedModule={exports:{} as {POST:(request:Request)=>Promise<Response>}};
 new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(resolve('package.json')),evaluatedModule,evaluatedModule.exports);
 const response=await runWithTenantContext({organizationId:'wrong-outer-org',source:'test'},()=>evaluatedModule.exports.POST(new Request('https://example.test/api/election-removal/plans/postpone',{method:'POST',body:JSON.stringify({planId:'plan'})})));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{id:'plan',date:'2026-10-21',organizationId:'authenticated-org'});
});

test('unified continuation uses the authenticated tenant and checks plan access before mutation',async()=>{
 const context=resolve('lib/tenant-context.ts').replaceAll('\\','/');
 const bundle=await build({entryPoints:['app/api/work/route/continue/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'unified-route-boundaries',setup(b){
  b.onResolve({filter:/\/(api-auth|field-planning\/service|election-removal\/postpone-plan)$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'ts',resolveDir:process.cwd(),contents:args.path.endsWith('/api-auth')?
   'export async function requireApiAccess(){return {organizationId:"authenticated-org",id:"manager",role:"MANAGER",email:"m@test"}};export const isApiDenied=()=>false;':
   args.path.endsWith('/service')?'import {requireTenantContext} from '+JSON.stringify(context)+';export function requirePlannerManager(){};export async function getPlan(id){if(id==="foreign")throw new Error("FORBIDDEN");if(requireTenantContext().organizationId!=="authenticated-org")throw new Error("wrong tenant");}':
   'import {requireTenantContext} from '+JSON.stringify(context)+';export async function postponeFieldPlan(id){await new Promise(r=>setImmediate(r));return {id,date:"2035-06-11",organizationId:requireTenantContext().organizationId};}'}));
 }}]});
 const evaluatedModule={exports:{} as {POST:(request:Request)=>Promise<Response>}};
 new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(resolve('package.json')),evaluatedModule,evaluatedModule.exports);
 const invoke=(planId:string)=>runWithTenantContext({organizationId:'wrong-outer-org',source:'test'},()=>evaluatedModule.exports.POST(new Request('https://example.test/api/work/route/continue',{method:'POST',body:JSON.stringify({planId})})));
 const response=await invoke('plan');assert.equal(response.status,200);assert.deepEqual(await response.json(),{id:'plan',date:'2035-06-11',organizationId:'authenticated-org'});
 assert.equal((await invoke('foreign')).status,403);
});
