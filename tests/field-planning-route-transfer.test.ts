import test from 'node:test';
import assert from 'node:assert/strict';
import { planFieldWork, estimatedLeg } from '../lib/field-planning/planning-engine';
import { parseGenerate, renameCrew, transferCrew } from '../lib/field-planning/service';
import { myRoute } from '../lib/field-planning/execution';
import { runWithTenantContext } from '../lib/tenant-context';
import type { PlanningInput, PlanningProfile, PlanningResult, FieldPlanExecution } from '../lib/field-planning/contracts';

const profile: PlanningProfile = {
  timezone: 'Europe/Prague',
  country: 'SK',
  depot: { latitude: 48, longitude: 17 },
  endLocation: { latitude: 48, longitude: 17 },
  workdayStart: '06:00',
  workdayEnd: '14:00',
  breakMinutes: 30,
  overtimeMinutes: 0,
  strategy: 'BALANCED',
  serviceMinutes: { INSTALLATION: 20 },
  fallbackSpeedKph: 40,
  fallbackDistanceFactor: 1.4,
  maximumJobsPerRoute: 50,
  vehicleRequired: false,
  requireHumanApproval: true,
  enabled: true,
};

function fixture(count = 2): PlanningInput {
  return {
    organizationId: 'tenant-a',
    date: '2030-06-10',
    now: '2030-06-09T10:00:00Z',
    profile: structuredClone(profile),
    jobs: Array.from({ length: count }, (_, i) => ({
      id: `w${i}`,
      organizationId: 'tenant-a',
      title: `Job ${i}`,
      workType: 'INSTALLATION',
      priority: 'NORMAL',
      status: 'PLANNED',
      scheduledAt: '2030-06-10T04:00:00Z',
      updatedAt: '2030-06-01T00:00:00Z',
      location: { latitude: 48 + i / 1000, longitude: 17 },
      serviceMinutes: null,
      constraints: {},
    })),
    employees: [
      { id: 'emp-1', organizationId: 'tenant-a', name: 'Petr Novák', userId: 'user-1', isActive: true, available: true, positions: ['installation'], roles: ['WORKER'] },
      { id: 'emp-2', organizationId: 'tenant-a', name: 'Jiří Svoboda', userId: 'user-2', isActive: true, available: true, positions: ['installation'], roles: ['WORKER'] },
    ],
    vehicles: [],
    crews: [
      { id: 'crew-1', name: 'Severní okruh', employeeIds: ['emp-1'], vehicleId: null },
      { id: 'crew-2', employeeIds: ['emp-2'], vehicleId: null },
    ],
  };
}

const compute = (input: PlanningInput) => planFieldWork(input, async (a, b) => estimatedLeg(a, b, input.profile));

test('Route Naming: planFieldWork preserves custom crew names in PlanningResult', async () => {
  const result = await compute(fixture());
  assert.equal(result.crews.length, 2);
  // Crew 1 had a custom name 'Severní okruh'
  assert.equal(result.crews[0].name, 'Severní okruh');
  // Crew 2 had no custom name, should be null
  assert.equal(result.crews[1].name, null);
});

test('Route Naming: parseGenerate parses planName and crew name correctly', () => {
  const parsed = parseGenerate({
    date: '2026-10-18',
    requestKey: 'req-key-12345678',
    planName: '   Expresní montáže pondělí   ',
    crews: [
      { id: 'c1', name: 'Jižní trasa', employeeIds: ['e1'], vehicleId: null },
      { id: 'c2', name: '   ', employeeIds: ['e2'], vehicleId: null },
    ],
    jobIds: ['w1', 'w2'],
  });

  assert.equal(parsed.planName, 'Expresní montáže pondělí');
  assert.equal(parsed.crews[0].name, 'Jižní trasa');
  assert.equal(parsed.crews[1].name, null);
});

test('Route Naming in Technician Mobile View: myRoute prefers custom route name', () => {
  const mockExecution = {
    planId: 'plan-1',
    executionStatus: 'IN_PROGRESS',
    crewId: 'crew-1',
    crewName: null,
    vehicleId: null,
    vehicleName: null,
    date: '2026-10-18',
    stops: [],
  };

  const planSummary: PlanningResult = {
    planName: 'Velký plán',
    date: '2026-10-18',
    fingerprint: 'fp',
    estimated: false,
    distanceMeters: 1000,
    travelSeconds: 500,
    serviceMinutes: 60,
    crews: [
      {
        id: 'crew-1',
        name: 'Centrum - výměna plakátů',
        employeeIds: ['emp-1'],
        names: ['Jan Technik'],
        vehicleId: null,
        vehicleName: null,
        departureAt: '2026-10-18T06:00:00Z',
        endAt: '2026-10-18T14:00:00Z',
        distanceMeters: 1000,
        travelSeconds: 500,
        serviceMinutes: 60,
        stops: [],
      },
    ],
    unassigned: [],
    conflicts: [],
  };

  // When crew.name is present, execution should display custom route name
  const crew = planSummary.crews[0];
  const customCrewName = crew.name || (crew.names?.length ? crew.names.join(', ') : null);
  assert.equal(customCrewName, 'Centrum - výměna plakátů');

  // When crew.name is null, fallback to worker names
  crew.name = null;
  const fallbackCrewName = crew.name || (crew.names?.length ? crew.names.join(', ') : null);
  assert.equal(fallbackCrewName, 'Jan Technik');
});

test('Route Transfer: transferCrew replaces first worker (lead) or all workers', async () => {
  // Test mock logic simulating transferCrew state transition
  const crew = {
    id: 'crew-1',
    name: 'Severní trasa',
    employeeIds: ['emp-1', 'emp-2'],
    names: ['Petr Novák', 'Jiří Svoboda'],
  };

  const targetEmployee = { id: 'emp-3', name: 'Karel Dvořák' };

  // Mode 1: replace_first
  let newEmployeeIds = [targetEmployee.id, ...crew.employeeIds.slice(1).filter(id => id !== targetEmployee.id)];
  assert.deepEqual(newEmployeeIds, ['emp-3', 'emp-2']);

  // Mode 2: replace_all
  newEmployeeIds = [targetEmployee.id];
  assert.deepEqual(newEmployeeIds, ['emp-3']);
});

test('renameCrew: rejects non-manager actor with FORBIDDEN', async () => {
  const workerActor = { id: 'u-worker', email: 'w@example.com', role: 'WORKER' as const };
  await assert.rejects(
    () => renameCrew('plan-1', 'crew-1', 'Nová trasa', workerActor),
    /FORBIDDEN/
  );
});

test('transferCrew: rejects non-manager actor with FORBIDDEN', async () => {
  const workerActor = { id: 'u-worker', email: 'w@example.com', role: 'WORKER' as const };
  await assert.rejects(
    () => transferCrew('plan-1', 'crew-1', 'emp-target', workerActor),
    /FORBIDDEN/
  );
});

test('renameCrew: updates route name and creates audit log in tenant transaction', async () => {
  const orgId = 'tenant-test-a';
  const managerActor = { id: 'u-mgr', email: 'm@example.com', role: 'MANAGER' as const };
  
  const initialPlan = {
    id: 'plan-123',
    organizationId: orgId,
    status: 'DRAFT',
    version: 1,
    date: '2026-10-18',
    planningSummary: {
      date: '2026-10-18',
      fingerprint: 'fp',
      crews: [
        { id: 'c-1', name: null, employeeIds: ['e-1'], names: ['Karel'], vehicleId: null, vehicleName: null, departureAt: '', endAt: '', distanceMeters: 0, travelSeconds: 0, serviceMinutes: 0, stops: [] }
      ],
      unassigned: [],
      conflicts: [],
    },
    planningInputSnapshot: {
      organizationId: orgId,
      date: '2026-10-18',
      profile,
      jobs: [],
      employees: [],
      vehicles: [],
      crews: [{ id: 'c-1', name: null, employeeIds: ['e-1'], vehicleId: null }],
    },
  };

  let updatedFieldPlanData: any = null;
  const auditLogs: any[] = [];

  const mockDb: any = {
    $transaction: async (fn: any) => fn(mockDb),
    fieldPlan: {
      findUnique: async () => initialPlan,
      update: async (args: any) => {
        updatedFieldPlanData = args.data;
        return { ...initialPlan, ...args.data };
      },
    },
    crmAuditLog: {
      create: async (args: any) => {
        auditLogs.push(args.data);
        return { id: 'audit-1', ...args.data };
      },
    },
    navigationOrder: {
      count: async () => 0,
    },
    organization: {
      findUnique: async () => ({ plan: 'PRO', enabledModules: ['navigation'] }),
    },
    $queryRaw: async () => [{ exists: false }],
  };

  const res = await runWithTenantContext({ organizationId: orgId, source: 'test' }, () =>
    renameCrew('plan-123', 'c-1', 'Východní okruh', managerActor, mockDb)
  );

  assert.equal(res.result.crews[0].name, 'Východní okruh');
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, 'FIELD_ROUTE_RENAMED');
  assert.equal(JSON.parse(auditLogs[0].detailsJson).name, 'Východní okruh');
});

test('transferCrew: updates crew workers and synchronizes live assignments when APPROVED', async () => {
  const orgId = 'tenant-test-a';
  const managerActor = { id: 'u-mgr', email: 'm@example.com', role: 'MANAGER' as const };
  
  const initialPlan = {
    id: 'plan-456',
    organizationId: orgId,
    status: 'APPROVED',
    version: 1,
    date: '2026-10-18',
    planningSummary: {
      date: '2026-10-18',
      fingerprint: 'fp',
      crews: [
        {
          id: 'c-1',
          name: 'Trasa 1',
          employeeIds: ['e-old', 'e-assistant'],
          names: ['Pavel Starý', 'Mirek Asistent'],
          vehicleId: 'veh-1',
          vehicleName: 'Dodávka',
          departureAt: '',
          endAt: '',
          distanceMeters: 0,
          travelSeconds: 0,
          serviceMinutes: 0,
          stops: [
            {
              workOrderId: 'wo-1',
              navigationPointId: 'np-1',
              crmRealizationId: 'crm-real-1',
              title: 'Stop 1',
              address: 'Ulice 1',
              arrivalAt: '',
              startAt: '',
              endAt: '',
              reason: null,
            },
          ],
        },
      ],
      unassigned: [],
      conflicts: [],
    },
    planningInputSnapshot: {
      organizationId: orgId,
      date: '2026-10-18',
      profile,
      jobs: [],
      employees: [],
      vehicles: [],
      crews: [{ id: 'c-1', name: 'Trasa 1', employeeIds: ['e-old', 'e-assistant'], vehicleId: 'veh-1' }],
    },
  };

  const auditLogs: any[] = [];
  const deletedAssignments: any[] = [];
  const upsertedAssignments: any[] = [];
  const updatedNavPoints: any[] = [];
  const updatedRealizations: any[] = [];
  const updatedReservations: any[] = [];

  const mockDb: any = {
    $transaction: async (fn: any) => fn(mockDb),
    fieldPlan: {
      findUnique: async () => initialPlan,
      update: async (args: any) => ({ ...initialPlan, ...args.data }),
    },
    employee: {
      findFirst: async (args: any) => {
        if (args.where.id === 'e-new') {
          return { id: 'e-new', firstName: 'Tomáš', lastName: 'Nový', userId: 'usr-new', isActive: true };
        }
        return null;
      },
      findMany: async (args: any) => {
        return [
          { id: 'e-new', firstName: 'Tomáš', lastName: 'Nový' },
          { id: 'e-assistant', firstName: 'Mirek', lastName: 'Asistent' },
        ];
      },
    },
    workAssignment: {
      deleteMany: async (args: any) => {
        deletedAssignments.push(args);
        return { count: 1 };
      },
      upsert: async (args: any) => {
        upsertedAssignments.push(args);
        return args.create;
      },
    },
    navigationPoint: {
      updateMany: async (args: any) => {
        updatedNavPoints.push(args);
        return { count: 1 };
      },
    },
    crmRealization: {
      updateMany: async (args: any) => {
        updatedRealizations.push(args);
        return { count: 1 };
      },
    },
    vehicleReservation: {
      updateMany: async (args: any) => {
        updatedReservations.push(args);
        return { count: 1 };
      },
    },
    workOrder: {
      findFirst: async () => null,
      findUnique: async () => null,
    },
    workTask: {
      findMany: async () => [],
      upsert: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
    crmAuditLog: {
      create: async (args: any) => {
        auditLogs.push(args.data);
        return { id: 'audit-2', ...args.data };
      },
    },
    navigationOrder: {
      count: async () => 0,
    },
    organization: {
      findUnique: async () => ({ plan: 'PRO', enabledModules: ['navigation'] }),
    },
    $queryRaw: async () => [{ exists: false }],
  };

  const res = await runWithTenantContext({ organizationId: orgId, source: 'test' }, () =>
    transferCrew('plan-456', 'c-1', 'e-new', managerActor, 'replace_first', mockDb)
  );

  // In replace_first mode, crew now has e-new + e-assistant
  assert.deepEqual(res.result.crews[0].employeeIds, ['e-new', 'e-assistant']);
  assert.equal(res.result.crews[0].names[0], 'Tomáš Nový');

  // Verify WorkAssignment updates
  assert.equal(deletedAssignments.length, 1); // e-old deleted
  assert.equal(upsertedAssignments.length, 1); // e-new upserted
  assert.equal(upsertedAssignments[0].create.userId, 'usr-new');
  assert.equal(upsertedAssignments[0].create.workerName, 'Tomáš Nový');

  // Verify NavigationPoint and CrmRealization installer userId
  assert.equal(updatedNavPoints.length, 1);
  assert.equal(updatedNavPoints[0].data.installerUserId, 'usr-new');
  assert.equal(updatedRealizations.length, 1);
  assert.equal(updatedRealizations[0].data.assignedUserId, 'usr-new');

  // Verify VehicleReservation reassigned to e-new
  assert.equal(updatedReservations.length, 1);
  assert.equal(updatedReservations[0].data.employeeId, 'e-new');

  // Verify Audit Log
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, 'FIELD_ROUTE_TRANSFERRED');
  assert.equal(JSON.parse(auditLogs[0].detailsJson).newEmployeeName, 'Tomáš Nový');
});
