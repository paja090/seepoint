import assert from 'node:assert/strict'; import test from 'node:test';
import { intervalsOverlap } from '../lib/rate-intervals.ts';
import { canManageWorkerFinancials, endDateBefore, selectRateAtDate } from '../lib/rate-selection.ts';
const d=(value:string)=>new Date(`${value}T00:00:00.000Z`);
const rate=(workType:string|null,from:string,to:string|null,kind='HOURLY')=>({workType,validFrom:d(from),validTo:to?d(to):null,kind});

test('hourly, task and fixed rates are representable and individual selection is date-bound',()=>{const rates=[rate(null,'2026-01-01',null,'HOURLY'),rate('INSTALLATION','2026-02-01',null,'TASK'),rate(null,'2025-01-01','2025-12-31','FIXED')];assert.equal(selectRateAtDate(rates,'INSTALLATION',d('2026-03-01'))?.kind,'TASK');assert.equal(selectRateAtDate(rates,null,d('2025-06-01'))?.kind,'FIXED')});
test('exact WorkType overrides a general individual rate',()=>{const rates=[rate(null,'2026-01-01',null),rate('INSTALLATION','2026-01-01',null,'TASK')];assert.equal(selectRateAtDate(rates,'INSTALLATION',d('2026-02-01'))?.kind,'TASK')});
test('validFrom and validTo boundaries are inclusive and open validTo remains selectable',()=>{const r=rate(null,'2026-01-01','2026-01-31');assert.equal(selectRateAtDate([r],null,d('2026-01-01')),r);assert.equal(selectRateAtDate([r],null,d('2026-01-31')),r);assert.ok(selectRateAtDate([rate(null,'2026-02-01',null)],null,d('2030-01-01')))});
test('missing rate returns null',()=>assert.equal(selectRateAtDate([],null,d('2026-01-01')),null));
test('rate intervals treat endpoints as inclusive and detect open-ended conflicts',()=>{assert.equal(intervalsOverlap({validFrom:d('2026-01-01'),validTo:d('2026-01-31')},{validFrom:d('2026-01-31'),validTo:null}),true);assert.equal(intervalsOverlap({validFrom:d('2026-01-01'),validTo:d('2026-01-30')},{validFrom:d('2026-01-31'),validTo:null}),false);assert.equal(intervalsOverlap({validFrom:d('2026-01-01'),validTo:null},{validFrom:d('2030-01-01'),validTo:d('2030-01-02')}),true)});
test('amount versioning ends previous daily interval one day before new version',()=>assert.equal(endDateBefore(d('2026-05-01')).toISOString(),d('2026-04-30').toISOString()));
test('only administrators can manage worker financials',()=>{assert.equal(canManageWorkerFinancials('ADMIN'),true);for(const role of ['WORKER','MANAGER','ACCOUNTANT','VIEWER'])assert.equal(canManageWorkerFinancials(role),false)});
