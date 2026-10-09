import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORK_TYPE_LABELS,
  aggregateFieldObservations,
  roundToSensibleMinutes,
  type RawFieldObservation,
} from '../lib/field-planning/ai-telemetry';

test('Field Planning AI Telemetry: Labels defined for all standard field work types', () => {
  assert.ok(WORK_TYPE_LABELS.INSTALLATION.includes('Montáž'));
  assert.ok(WORK_TYPE_LABELS.DEINSTALLATION.includes('Demontáž'));
  assert.ok(WORK_TYPE_LABELS.REINSTALLATION.includes('Přemontáž'));
  assert.ok(WORK_TYPE_LABELS.NAVIGATION_INSTALLATION.includes('navigačních'));
  assert.ok(WORK_TYPE_LABELS.ELECTION_REMOVAL.includes('Volební'));
});

test('Field Planning AI Telemetry: Rounds service minutes to sensible operational increments', () => {
  assert.equal(roundToSensibleMinutes(4), 4);
  assert.equal(roundToSensibleMinutes(8), 8);
  assert.equal(roundToSensibleMinutes(14), 15);
  assert.equal(roundToSensibleMinutes(22), 20);
  assert.equal(roundToSensibleMinutes(28), 30);
  assert.equal(roundToSensibleMinutes(44), 40);
  assert.equal(roundToSensibleMinutes(53), 50);
});

test('Field Planning AI Telemetry: Generates fallback analysis when no field observations exist', () => {
  const currentNorms = {
    INSTALLATION: 45,
    DEINSTALLATION: 30,
    NAVIGATION_INSTALLATION: 30,
    ELECTION_REMOVAL: 10,
  };

  const report = aggregateFieldObservations([], currentNorms, 'test-org');

  assert.equal(report.totalCompletedWithTimes, 0);
  assert.equal(report.overallEfficiencyPercent, 100);
  assert.ok(report.aggregates.length >= 8, 'Musí obsahovat všechny základní typy prací');

  const installationAgg = report.aggregates.find((a) => a.workType === 'INSTALLATION')!;
  assert.ok(installationAgg);
  assert.equal(installationAgg.completedCount, 0);
  assert.equal(installationAgg.confidenceScore, 'LOW');
  assert.equal(installationAgg.recommendedServiceMinutes, 45);

  assert.ok(report.aiSummary.includes('Zatím nebyly naměřeny žádné záznamy'));
  assert.ok(Object.keys(report.recommendedCalibration).length >= 8);
});

test('Field Planning AI Telemetry: Aggregates real observations and calculates calibrated recommendations', () => {
  const currentNorms = {
    INSTALLATION: 45,
    DEINSTALLATION: 30,
    NAVIGATION_INSTALLATION: 30,
    ELECTION_REMOVAL: 10,
  };

  const observations: RawFieldObservation[] = [
    // INSTALLATION: planned 45m, actually took around 30m (faster, 12 samples -> HIGH confidence)
    ...Array(12).fill(null).map((_, i) => ({
      workType: 'INSTALLATION',
      plannedMinutes: 45,
      actualMinutes: 28 + (i % 5), // 28 to 32 min, median ~30
    })),

    // DEINSTALLATION: planned 30m, actually took 42m (slower, 4 samples -> MEDIUM confidence)
    { workType: 'DEINSTALLATION', plannedMinutes: 30, actualMinutes: 40 },
    { workType: 'DEINSTALLATION', plannedMinutes: 30, actualMinutes: 42 },
    { workType: 'DEINSTALLATION', plannedMinutes: 30, actualMinutes: 45 },
    { workType: 'DEINSTALLATION', plannedMinutes: 30, actualMinutes: 41 },

    // ELECTION_REMOVAL: planned 10m, actually took 5m (3 samples -> MEDIUM confidence)
    { workType: 'ELECTION_REMOVAL', plannedMinutes: 10, actualMinutes: 5 },
    { workType: 'ELECTION_REMOVAL', plannedMinutes: 10, actualMinutes: 5 },
    { workType: 'ELECTION_REMOVAL', plannedMinutes: 10, actualMinutes: 6 },
  ];

  const report = aggregateFieldObservations(observations, currentNorms, 'test-org');

  assert.equal(report.totalCompletedWithTimes, 19);
  assert.ok(report.totalPlannedMinutes > 0);
  assert.ok(report.totalActualMinutes > 0);

  // Check INSTALLATION aggregate
  const instAgg = report.aggregates.find((a) => a.workType === 'INSTALLATION')!;
  assert.equal(instAgg.completedCount, 12);
  assert.equal(instAgg.confidenceScore, 'HIGH');
  assert.equal(instAgg.recommendedServiceMinutes, 30, 'AI kalibrace doporučuje zkrátit normu z 45m na 30m');
  assert.ok(instAgg.savedMinutesTotal > 0, 'Instalace ušetřily čas');

  // Check DEINSTALLATION aggregate
  const deinstAgg = report.aggregates.find((a) => a.workType === 'DEINSTALLATION')!;
  assert.equal(deinstAgg.completedCount, 4);
  assert.equal(deinstAgg.confidenceScore, 'MEDIUM');
  assert.ok(deinstAgg.recommendedServiceMinutes > 30, 'AI kalibrace doporučuje navýšit normu');
  assert.ok(deinstAgg.savedMinutesTotal < 0, 'Demontáže nabraly zpoždění');

  // Check ELECTION_REMOVAL aggregate
  const electAgg = report.aggregates.find((a) => a.workType === 'ELECTION_REMOVAL')!;
  assert.equal(electAgg.completedCount, 3);
  assert.ok(electAgg.recommendedServiceMinutes < 10, 'AI kalibrace doporučuje zkrátit normu na svoz');

  // Check Czech AI narrative
  assert.ok(report.aiSummary.length > 50);
  assert.ok(report.aiSummary.includes('efektivita') || report.aiSummary.includes('minut'));
});
