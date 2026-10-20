/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';import assert from 'node:assert/strict';
import {deletePhotoRecord,photoSiblingScope} from '../lib/photo-delete';
import {runWithTenantContext} from '../lib/tenant-context';
const base={id:'photo',carrierId:null,surfaceId:null,employeeId:null,electionRemovalPointId:null,fieldWorkStepId:null,workOrderItemId:null};
test('photo siblings follow their actual album; null carrier does not match all unlinked photos',()=>{
 assert.deepEqual(photoSiblingScope(base,'org'),{organizationId:'org',id:{in:[]}});
 assert.deepEqual(photoSiblingScope({...base,electionRemovalPointId:'point'},'org'),{organizationId:'org',id:{not:'photo'},electionRemovalPointId:'point'});
 assert.deepEqual(photoSiblingScope({...base,carrierId:'carrier',surfaceId:'surface'},'org'),{organizationId:'org',id:{not:'photo'},carrierId:'carrier',surfaceId:'surface'});
});
function fixture(){
 const photo:any={...base,electionRemovalPointId:'point',isPrimary:true,sortOrder:2,capturedByWorkerUserId:'worker'};const writes:any[]=[];
 const db:any={$transaction:async(fn:any)=>fn(db),photo:{findUnique:async({where,select}:any)=>{assert.equal(select.content,undefined);return where.organizationId==='org'?photo:null;},delete:async(args:any)=>writes.push(args),findFirst:async({where,select}:any)=>{assert.equal(where.electionRemovalPointId,'point');assert.deepEqual(select,{id:true});return{id:'sibling'};},update:async(args:any)=>writes.push(args),updateMany:async(args:any)=>writes.push(args)},crmAuditLog:{create:async(args:any)=>writes.push(args)}};
 const run=(role='MANAGER',organizationId='org',id='manager')=>runWithTenantContext({organizationId,source:'test'},()=>deletePhotoRecord('photo',{id,role,email:'test@test'},db));return {run,photo,writes};
}
test('deleting a field photo performs bounded metadata operations and preserves audit trail',async()=>{
 const f=fixture();await f.run();assert.equal(f.writes.length,4);assert.deepEqual(f.writes[0].where,{id:'photo',organizationId:'org'});assert.equal(f.writes[1].data.isPrimary,true);assert.deepEqual(f.writes[2].data,{sortOrder:{decrement:1}});assert.equal(f.writes[3].data.action,'PHOTO_DELETED');
});
test('photo deletion preserves role and tenant boundaries',async()=>{
 const f=fixture();await assert.rejects(f.run('WORKER'),/oprávnění/);await assert.rejects(f.run('ADMIN','other'),/nalezena/);f.photo.employeeId='employee';await assert.rejects(f.run(),/zaměstnance/);f.photo.employeeId=null;f.photo.workOrderItemId='item';await assert.rejects(f.run(),/dokladem/);assert.equal(f.writes.length,0);
});
