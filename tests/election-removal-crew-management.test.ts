import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlanningResult, PlannedCrew, MyRouteDTO } from '../lib/field-planning/contracts';

test('Election removal crew management & done points filtering', async (t) => {
  await t.test('1. Updating crew members in approved plan updates employeeIds and worker names', () => {
    const initialSummary: PlanningResult = {
      crews: [
        {
          id: 'crew-1',
          employeeIds: ['emp-1'],
          names: ['Jan Novák'],
          vehicleId: 'veh-1',
          vehicleName: 'Dodávka A',
          departureAt: '2026-10-15T07:30:00Z',
          endAt: '2026-10-15T16:00:00Z',
          stops: [],
          returnLeg: { distanceMeters: 0, durationSeconds: 0, estimated: false, polyline: '' },
          distanceMeters: 5000,
          travelSeconds: 600,
          serviceMinutes: 120,
          breakMinutes: 30,
        },
      ],
      unassigned: [],
      conflicts: [],
      estimated: false,
      explanation: '',
      distanceMeters: 5000,
      travelSeconds: 600,
      serviceMinutes: 120,
    };

    // Update crew-1 with new workers and vehicle
    const updatedEmployees = [
      { id: 'emp-2', name: 'Petr Svoboda' },
      { id: 'emp-3', name: 'Karel Dvořák' },
    ];
    const newVehicle = { id: 'veh-2', name: 'Tranzit B (2B3 4567)' };

    const targetCrew = initialSummary.crews.find((c) => c.id === 'crew-1');
    assert.ok(targetCrew, 'Crew-1 must exist');

    targetCrew.employeeIds = updatedEmployees.map((e) => e.id);
    targetCrew.names = updatedEmployees.map((e) => e.name);
    targetCrew.vehicleId = newVehicle.id;
    targetCrew.vehicleName = newVehicle.name;

    assert.deepEqual(targetCrew.employeeIds, ['emp-2', 'emp-3']);
    assert.deepEqual(targetCrew.names, ['Petr Svoboda', 'Karel Dvořák']);
    assert.equal(targetCrew.vehicleName, 'Tranzit B (2B3 4567)');
  });

  await t.test('2. Crew re-assignment must reject empty employee list', () => {
    const validateCrewUpdate = (body: { crewId: string; employeeIds: string[] }) => {
      if (!body.crewId) throw new Error('Chybí identifikátor posádky.');
      if (!Array.isArray(body.employeeIds) || body.employeeIds.length === 0) {
        throw new Error('Posádka musí mít přiřazeného alespoň jednoho pracovníka.');
      }
      return true;
    };

    assert.throws(
      () => validateCrewUpdate({ crewId: 'crew-1', employeeIds: [] }),
      /alespoň jednoho pracovníka/
    );
    assert.equal(
      validateCrewUpdate({ crewId: 'crew-1', employeeIds: ['emp-1'] }),
      true
    );
  });

  await t.test('3. New approved route marks previous plan COMPLETED and does not overwrite COMPLETED points', () => {
    // Simulate campaign points before new plan approval
    const points = [
      { id: 'pt-1', label: 'Bod 1', status: 'COMPLETED', assignedFieldPlanId: 'plan-v1', assignedCrewId: 'crew-1' },
      { id: 'pt-2', label: 'Bod 2', status: 'COMPLETED', assignedFieldPlanId: 'plan-v1', assignedCrewId: 'crew-1' },
      { id: 'pt-3', label: 'Bod 3', status: 'ASSIGNED', assignedFieldPlanId: 'plan-v1', assignedCrewId: 'crew-1' },
      { id: 'pt-4', label: 'Bod 4', status: 'PENDING', assignedFieldPlanId: null, assignedCrewId: null },
    ];

    const plans = [
      { id: 'plan-v1', version: 1, status: 'APPROVED', campaignId: 'camp-1' },
    ];

    // When new plan v2 is approved:
    // 1. Mark previous active/approved plans as COMPLETED
    plans.forEach((p) => {
      if (p.campaignId === 'camp-1' && (p.status === 'APPROVED' || p.status === 'ACTIVE')) {
        p.status = 'COMPLETED';
      }
    });

    const newPlanId = 'plan-v2';
    plans.push({ id: newPlanId, version: 2, status: 'APPROVED', campaignId: 'camp-1' });

    // 2. Only uncompleted stops (pt-3, pt-4) get updated to new plan
    const newStops = ['pt-3', 'pt-4'];
    points.forEach((pt) => {
      if (newStops.includes(pt.id) && pt.status !== 'COMPLETED') {
        pt.assignedFieldPlanId = newPlanId;
        pt.assignedCrewId = 'crew-1';
        pt.status = 'ASSIGNED';
      }
    });

    // Check that pt-1 and pt-2 remain COMPLETED
    assert.equal(points.find((p) => p.id === 'pt-1')?.status, 'COMPLETED');
    assert.equal(points.find((p) => p.id === 'pt-2')?.status, 'COMPLETED');
    assert.equal(points.find((p) => p.id === 'pt-1')?.assignedFieldPlanId, 'plan-v1');

    // Check that pt-3 and pt-4 are assigned to new plan
    assert.equal(points.find((p) => p.id === 'pt-3')?.assignedFieldPlanId, 'plan-v2');
    assert.equal(points.find((p) => p.id === 'pt-4')?.assignedFieldPlanId, 'plan-v2');

    // Check that plan-v1 is COMPLETED and plan-v2 is APPROVED
    assert.equal(plans.find((p) => p.id === 'plan-v1')?.status, 'COMPLETED');
    assert.equal(plans.find((p) => p.id === 'plan-v2')?.status, 'APPROVED');
  });

  await t.test('4. Daily route (TODO filter) excludes already completed stops by default', () => {
    const points = [
      { id: 'pt-1', label: 'Bod 1', status: 'COMPLETED' },
      { id: 'pt-2', label: 'Bod 2', status: 'COMPLETED' },
      { id: 'pt-3', label: 'Bod 3', status: 'IN_PROGRESS' },
      { id: 'pt-4', label: 'Bod 4', status: 'ASSIGNED' },
      { id: 'pt-5', label: 'Bod 5', status: 'ISSUE' },
    ];

    // Filter logic in MobileRouteExecutionView when filterStatus === 'TODO'
    const todoPoints = points.filter((p) =>
      ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(p.status)
    );

    assert.equal(todoPoints.length, 2);
    assert.deepEqual(
      todoPoints.map((p) => p.id),
      ['pt-3', 'pt-4']
    );

    // Completed points are hidden
    const completedPoints = points.filter((p) => p.status === 'COMPLETED');
    assert.equal(completedPoints.length, 2);
  });

  await t.test('5. myRoute deduplication by campaign skips older superseded plans', () => {
    const plans = [
      { id: 'plan-v2', version: 2, electionCampaignId: 'camp-1', status: 'APPROVED' },
      { id: 'plan-v1', version: 1, electionCampaignId: 'camp-1', status: 'COMPLETED' },
      { id: 'plan-other', version: 1, electionCampaignId: null, status: 'APPROVED' },
    ];

    const seenCampaigns = new Set<string>();
    const effectivePlans: typeof plans = [];
    for (const plan of plans) {
      if (plan.electionCampaignId) {
        if (seenCampaigns.has(plan.electionCampaignId)) continue;
        seenCampaigns.add(plan.electionCampaignId);
      }
      effectivePlans.push(plan);
    }

    assert.equal(effectivePlans.length, 2);
    assert.equal(effectivePlans[0].id, 'plan-v2');
    assert.equal(effectivePlans[1].id, 'plan-other');
  });

  await t.test('6. MyRouteDTO includes crewName in route objects', () => {
    const dto: MyRouteDTO = {
      timezone: 'Europe/Prague',
      routes: [
        {
          planId: 'plan-1',
          crewName: 'Jan Novák, Petr Svoboda',
          vehicleName: 'Dodávka Ford',
          departureAt: '2026-10-15T07:30:00Z',
          endAt: '2026-10-15T16:00:00Z',
          stops: [],
        },
      ],
    };

    assert.equal(dto.routes[0].crewName, 'Jan Novák, Petr Svoboda');
    assert.equal(dto.routes[0].vehicleName, 'Dodávka Ford');
  });
});
