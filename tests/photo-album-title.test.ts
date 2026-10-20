/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';import assert from 'node:assert/strict';
import {saveAlbumTitle,readAlbumTitle,campaignAlbumKey,albumItemKey,navigationAlbumKey} from '../lib/fotodokumentace/album-title';
import {runWithTenantContext} from '../lib/tenant-context';
function fixture(){const titles=new Map<string,string>();const audits:any[]=[];const campaign={id:'campaign',name:'Internal draft',clientName:'Client',points:[{label:'Point',description:null,layerName:null}]};const db:any={$transaction:async(fn:any)=>fn(db),electionCampaign:{findFirst:async({where}:any)=>where.organizationId==='org'&&where.id==='campaign'?campaign:null},navigationDocumentationReport:{findFirst:async()=>({id:'nav'})},photoAlbumSettings:{upsert:async({create}:any)=>titles.set(create.albumKey,create.publicTitle),findUnique:async({where}:any)=>({publicTitle:where.organizationId_albumKey.organizationId==='org'?titles.get(where.organizationId_albumKey.albumKey):undefined})},crmAuditLog:{create:async({data}:any)=>audits.push(data)}};const save=(id='campaign',title:unknown='Client – October',source='FIELD_WORK',role='MANAGER',organizationId='org')=>runWithTenantContext({organizationId,source:'test'},()=>saveAlbumTitle(id,{title,source},{id:'user',email:'test@test',role},db));return {titles,audits,campaign,db,save};}
test('public title persists separately from internal campaign name, including existing client links',async()=>{
 const f=fixture();await f.save();assert.equal(f.campaign.name,'Internal draft');assert.equal(await readAlbumTitle('org',campaignAlbumKey('campaign'),'old',f.db),'Client – October');assert.equal(f.audits.length,1);
 await f.save('campaign::client::Client','Special album');assert.equal(await readAlbumTitle('org',campaignAlbumKey('campaign','CLIENT'),'old',f.db),'Special album');assert.equal(await readAlbumTitle('other',campaignAlbumKey('campaign'),'old',f.db),'old');
 assert.equal(albumItemKey({id:'campaign::client::Client',source:'FIELD_WORK',albumSlug:'signed'}),campaignAlbumKey('campaign','Client'));
 await f.save('nav','Navigation title','NAVIGATION');assert.equal(f.titles.get(navigationAlbumKey('nav')),'Navigation title');
});
test('rename rejects invalid title, foreign tenant, unknown client and worker',async()=>{
 const f=fixture();await assert.rejects(f.save('campaign',''),/1 až 160/);await assert.rejects(f.save('campaign','x'.repeat(161)),/1 až 160/);await assert.rejects(f.save('campaign','ok','FIELD_WORK','WORKER'),/manažer/);await assert.rejects(f.save('campaign','ok','FIELD_WORK','MANAGER','other'),/nalezeno/);await assert.rejects(f.save('campaign::client::Other'),/nalezeno/);assert.equal(f.titles.size,0);
});
