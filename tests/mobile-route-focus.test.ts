import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRouteStop } from '../lib/field-planning/mobile-focus';
test('resume started work before other pending stops and preserve original sequence',()=>{
 const stops=[{id:'pending',status:'PLANNED'},{id:'started',status:'IN_PROGRESS'},{id:'later',status:'PLANNED'}];assert.equal(nextRouteStop(stops)?.id,'started');stops[1].status='DONE';assert.equal(nextRouteStop(stops)?.id,'pending');assert.deepEqual(stops.map(s=>s.id),['pending','started','later']);
});
test('finished and cancelled work is excluded; problems remain when routine work is finished',()=>{
 const stops=[{id:'done',status:'DONE'},{id:'cancelled',status:'CANCELLED'},{id:'issue',status:'ISSUE'},{id:'pending',status:'PLANNED'}];assert.equal(nextRouteStop(stops)?.id,'pending');stops[3].status='DONE';assert.equal(nextRouteStop(stops)?.id,'issue');stops[2].status='DONE';assert.equal(nextRouteStop(stops),undefined);
});
