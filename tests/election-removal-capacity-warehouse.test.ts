import test from 'node:test';
import assert from 'node:assert/strict';
import { planFieldWork } from '../lib/field-planning/planning-engine';
import { calculateMediaLoadSlots, calculateServiceMinutes } from '../lib/election-removal/constants';
import { analyzeCampaignTelemetry } from '../lib/election-removal/ai-telemetry';
import { input, job, travel } from './helpers/field-work';

// Test the real shared engine with explicit load requirements, independent of legacy text classification.
test('32 pickups require one intermediate and one final unload', async () => {
 const i = input(Array.from({length:32},(_,n) => job({id:'acko-'+n,loadSlots:1,mediaType:'ACKO',serviceMinutes:3})));
 i.profile.workdayEnd='23:00';
 const c=(await planFieldWork(i,travel)).crews[0];
 const unloads=c.stops.filter(s=>s.isWarehousePitstop);
 assert.deepEqual(unloads.map(s=>s.unloadedSlots),[30,2]);
 assert.equal(c.stops.filter(s=>!s.isWarehousePitstop).length,32);
});
test('six mini towers require an intermediate 30-slot unload and a final 6-slot unload',async()=>{
 const i=input(Array.from({length:6},(_,n)=>job({id:'mini-'+n,loadSlots:calculateMediaLoadSlots('MINI_TOWER','FULL_REMOVAL',1),mediaType:'MINI_TOWER'})));
 assert.deepEqual((await planFieldWork(i,travel)).crews[0].stops.filter(s=>s.isWarehousePitstop).map(s=>s.unloadedSlots),[30,6]);
});
test('ad replacement has no automatic structural load or warehouse visit',async()=>{
 const i=input([job({operationType:'REPLACE_AD',loadSlots:0})]);
 assert.equal((await planFieldWork(i,travel)).crews[0].stops.length,1);
 assert.equal(calculateMediaLoadSlots('TOWER','BANNER_CHANGE',2),0);
 assert.ok(calculateServiceMinutes('TOWER',1,null,'BANNER_CHANGE').totalMinutes<calculateServiceMinutes('TOWER',1).totalMinutes);
});
test('mixed mode permits different media on board within actual vehicle capacity',async()=>{
 const i=input([job({id:'a',loadSlots:1,mediaType:'ACKO'}),job({id:'b',loadSlots:6,mediaType:'MINI_TOWER'})]);i.profile.routeMode='MIXED';
 const c=(await planFieldWork(i,travel)).crews[0];assert.equal(c.stops.filter(s=>s.isWarehousePitstop).length,1);assert.equal(c.stops.at(-1)?.unloadedSlots,7);
});
test('AI Telemetry: Measures real field durations and computes AI calibration recommendation', () => {
  const points = [
    {
      id: 'pt-1',
      mediaType: 'ACKO' as const,
      serviceMinutes: 5, // planned
      startedAt: new Date('2026-10-06T10:00:00Z'),
      completedAt: new Date('2026-10-06T10:04:00Z'), // actual: 4 min (faster)
      status: 'COMPLETED',
    },
    {
      id: 'pt-2',
      mediaType: 'ACKO' as const,
      serviceMinutes: 5,
      startedAt: new Date('2026-10-06T10:10:00Z'),
      completedAt: new Date('2026-10-06T10:13:30Z'), // actual: 4 min (faster)
      status: 'COMPLETED',
    },
    {
      id: 'pt-3',
      mediaType: 'MINI_TOWER' as const,
      serviceMinutes: 10, // planned
      startedAt: new Date('2026-10-06T10:30:00Z'),
      completedAt: new Date('2026-10-06T10:45:00Z'), // actual: 15 min (slower)
      status: 'COMPLETED',
    },
  ];

  const report = analyzeCampaignTelemetry(points);

  assert.equal(report.totalCompletedWithTimes, 3);
  assert.equal(report.aggregates.length, 2);

  const ackoAgg = report.aggregates.find((a) => a.mediaType === 'ACKO')!;
  assert.equal(ackoAgg.completedCount, 2);
  assert.equal(ackoAgg.actualMinutesMedian, 4);
  assert.equal(ackoAgg.recommendedServiceMinutes, 4, 'AI doporučuje zkrátit normu na Áčko na 4 min');

  const miniAgg = report.aggregates.find((a) => a.mediaType === 'MINI_TOWER')!;
  assert.equal(miniAgg.completedCount, 1);
  assert.equal(miniAgg.actualMinutesMedian, 15);
  assert.equal(miniAgg.recommendedServiceMinutes, 15, 'AI doporučuje prodloužit normu na MiniTower na 15 min');

  assert.ok(report.aiSummary.length > 20, 'AI shrnutí musí obsahovat konkrétní analýzu v češtině');
});

