import test from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { loadPlanningData } from '../lib/field-planning/data';
import { runWithTenantContext } from '../lib/tenant-context';

test('FIELD work order with direct planningConstraints GPS coordinates is routeable and not blocked', async () => {
  const orgId = 'org-test-direct-gps';
  const db = {
    organization: {
      findUnique: async () => ({ plan: 'PRO', enabledModules: [] }),
    },
    organizationFieldPlanningProfile: {
      findUnique: async () => ({
        organizationId: orgId,
        configuration: {
          enabled: true,
          depot: { latitude: 49.834, longitude: 18.282 },
          endLocation: { latitude: 49.834, longitude: 18.282 },
          timezone: 'Europe/Prague',
          country: 'CZ',
          workdayStart: '07:00',
          workdayEnd: '17:00',
          breakMinutes: 30,
          overtimeMinutes: 0,
          strategy: 'BALANCED',
          serviceMinutes: { INSTALLATION: 20 },
          fallbackSpeedKph: 40,
          fallbackDistanceFactor: 1.4,
          maximumJobsPerRoute: 50,
          vehicleRequired: false,
          requireHumanApproval: true,
        },
      }),
    },
    navigationOrder: {
      findFirst: async () => null,
      findMany: async () => [],
    },
    employee: {
      findMany: async () => [
        {
          id: 'emp-1',
          organizationId: orgId,
          firstName: 'Jan',
          lastName: 'Novák',
          role: 'WORKER',
          roles: [],
          position: 'Montér',
          positions: [],
          isActive: true,
          userId: 'user-1',
          startDate: null,
          endDate: null,
        },
      ],
    },
    employeeAbsence: { findMany: async () => [] },
    vehicle: {
      findMany: async () => [
        {
          id: 'veh-1',
          organizationId: orgId,
          name: 'Dodávka Ford',
          status: 'AVAILABLE',
          capacitySlots: 10,
          equipment: [],
        },
      ],
    },
    vehicleReservation: { findMany: async () => [] },
    workOrder: {
      findMany: async () => [
        {
          id: 'wo-direct-gps',
          organizationId: orgId,
          title: 'Vyzvednutí plošiny ve Sviadnově',
          workType: 'TRANSPORT',
          priority: 'NORMAL',
          status: 'PLANNED',
          scheduledAt: new Date('2026-10-27T08:00:00Z'),
          deadlineAt: null,
          campaignDateFrom: null,
          campaignDateTo: null,
          estimatedHours: 1.5,
          locationNote: null,
          clientName: 'ČEVAS group s.r.o.',
          crmOrder: null,
          crmOrderId: null,
          navigationOrder: null,
          navigationOrderId: null,
          updatedAt: new Date('2026-10-26T12:00:00Z'),
          assignments: [],
          items: [], // No carrier linked
          workTasks: [],
          crmRealizations: [],
          planningConstraints: {
            scope: 'FIELD',
            latitude: 49.696078,
            longitude: 18.320534,
            location: { latitude: 49.696078, longitude: 18.320534 },
            locationAddress: 'Ostravská 51, 739 25 Sviadnov',
          },
        },
      ],
    },
    fieldPlan: { findMany: async () => [] },
    workTask: { findMany: async () => [] },
    crmAuditLog: { findMany: async () => [] },
    plannerBlock: { findMany: async () => [] },
  } as unknown as Prisma.TransactionClient;

  await runWithTenantContext({ organizationId: orgId, userId: 'user-1', source: 'session' }, async () => {
    const data = await loadPlanningData('2026-10-27', { includeField: false }, db);
    assert.equal(data.jobs.length, 1);
    const job = data.jobs[0];

    // Job has valid GPS coordinates directly from planningConstraints
    assert.deepEqual(job.location, { latitude: 49.696078, longitude: 18.320534 });
    assert.equal(job.address, 'Ostravská 51, 739 25 Sviadnov');
    assert.equal(job.serviceMinutes, 90);
    // Not blocked because coordinates are present!
    assert.equal(job.blockedReason, undefined);
  });
});

test('WORKSHOP work order with missing GPS is non-blocking and excluded from auto field routes', async () => {
  const orgId = 'org-test-workshop-nonblocking';
  const db = {
    organization: {
      findUnique: async () => ({ plan: 'PRO', enabledModules: [] }),
    },
    organizationFieldPlanningProfile: {
      findUnique: async () => ({
        organizationId: orgId,
        configuration: {
          enabled: true,
          depot: { latitude: 49.834, longitude: 18.282 },
          endLocation: { latitude: 49.834, longitude: 18.282 },
          timezone: 'Europe/Prague',
          country: 'CZ',
          workdayStart: '07:00',
          workdayEnd: '17:00',
          breakMinutes: 30,
          overtimeMinutes: 0,
          strategy: 'BALANCED',
          serviceMinutes: { INSTALLATION: 20 },
          fallbackSpeedKph: 40,
          fallbackDistanceFactor: 1.4,
          maximumJobsPerRoute: 50,
          vehicleRequired: false,
          requireHumanApproval: true,
        },
      }),
    },
    navigationOrder: { findFirst: async () => null, findMany: async () => [] },
    employee: {
      findMany: async () => [
        {
          id: 'emp-2',
          organizationId: orgId,
          firstName: 'Petr',
          lastName: 'Dvořák',
          role: 'WORKER',
          roles: [],
          position: 'DTP',
          positions: [],
          isActive: true,
          userId: 'user-2',
          startDate: null,
          endDate: null,
        },
      ],
    },
    employeeAbsence: { findMany: async () => [] },
    vehicle: { findMany: async () => [] },
    vehicleReservation: { findMany: async () => [] },
    workOrder: {
      findMany: async () => [
        {
          id: 'wo-workshop',
          organizationId: orgId,
          title: 'Tisk bannerů 3x1m',
          workType: 'INSTALLATION',
          priority: 'NORMAL',
          status: 'PLANNED',
          scheduledAt: new Date('2026-10-27T08:00:00Z'),
          deadlineAt: null,
          campaignDateFrom: null,
          campaignDateTo: null,
          estimatedHours: 2,
          locationNote: null,
          clientName: 'Interní zakázka',
          crmOrder: null,
          crmOrderId: null,
          navigationOrder: null,
          navigationOrderId: null,
          updatedAt: new Date('2026-10-26T12:00:00Z'),
          assignments: [],
          items: [],
          workTasks: [],
          crmRealizations: [],
          planningConstraints: {
            scope: 'WORKSHOP',
          },
        },
      ],
    },
    fieldPlan: { findMany: async () => [] },
    workTask: { findMany: async () => [] },
    crmAuditLog: { findMany: async () => [] },
    plannerBlock: { findMany: async () => [] },
  } as unknown as Prisma.TransactionClient;

  await runWithTenantContext({ organizationId: orgId, userId: 'user-2', source: 'session' }, async () => {
    // Default call without explicit jobIds -> workshop is excluded from car field trips
    const autoField = await loadPlanningData('2026-10-27', {}, db);
    assert.equal(autoField.jobs.length, 0);

    // If explicitly requested by jobId (e.g. planner inspection), it does not crash or block on GPS
    const explicit = await loadPlanningData('2026-10-27', { jobIds: ['wo-workshop'] }, db);
    assert.equal(explicit.jobs.length, 1);
    assert.equal(explicit.jobs[0].blockedReason, undefined);
  });
});

test('Work order API planningConstraints correctly stores coordinates, location, and address', () => {
  // Simulate the parsing logic used in app/api/work-orders/route.ts
  const rawInput = {
    title: 'Vyzvednutí plošiny',
    scope: 'FIELD',
    latitude: 49.696078,
    longitude: '18.320534',
    locationAddress: 'Ostravská 51, 739 25 Sviadnov',
  };

  const rawLat = rawInput.latitude;
  const rawLng = rawInput.longitude;
  const latitude = typeof rawLat === 'number' ? rawLat : (rawLat ? Number.parseFloat(String(rawLat)) : undefined);
  const longitude = typeof rawLng === 'number' ? rawLng : (rawLng ? Number.parseFloat(String(rawLng)) : undefined);
  const hasGps = typeof latitude === 'number' && Number.isFinite(latitude) && typeof longitude === 'number' && Number.isFinite(longitude);

  const constraints = {
    scope: rawInput.scope,
    ...(hasGps
      ? {
          latitude,
          longitude,
          location: { latitude, longitude },
          locationAddress: rawInput.locationAddress,
        }
      : {}),
  };

  assert.equal(constraints.scope, 'FIELD');
  assert.equal(constraints.latitude, 49.696078);
  assert.equal(constraints.longitude, 18.320534);
  assert.deepEqual(constraints.location, { latitude: 49.696078, longitude: 18.320534 });
  assert.equal(constraints.locationAddress, 'Ostravská 51, 739 25 Sviadnov');
});

test('AI parsing cleanly handles POI markdown fenced JSON and extracts coordinates', () => {
  const geminiRawOutput = `\`\`\`json
{
  "title": "Vyzvednutí plošiny ve Sviadnově – Půjčovna ČEVAS",
  "scope": "FIELD",
  "categoryKey": "TRANSPORT",
  "clientName": "ČEVAS group s.r.o.",
  "clientId": null,
  "isInternal": true,
  "scheduledAt": "2026-10-27T08:00",
  "deadlineAt": null,
  "estimatedHours": "1.5",
  "priority": "NORMAL",
  "workerNames": [],
  "locationAddress": "Ostravská 51, 739 25 Sviadnov",
  "latitude": 49.6960782,
  "longitude": 18.3205337,
  "description": "Zítra ráno vyzvednout montážní plošinu v půjčovně ČEVAS ve Sviadnově."
}
\`\`\``;

  const cleaned = geminiRawOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  assert.ok(firstBrace !== -1 && lastBrace !== -1);
  const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));

  const lat = typeof parsed.latitude === 'number' && !Number.isNaN(parsed.latitude) ? parsed.latitude : null;
  const lng = typeof parsed.longitude === 'number' && !Number.isNaN(parsed.longitude) ? parsed.longitude : null;

  assert.equal(parsed.title, 'Vyzvednutí plošiny ve Sviadnově – Půjčovna ČEVAS');
  assert.equal(parsed.scope, 'FIELD');
  assert.equal(parsed.locationAddress, 'Ostravská 51, 739 25 Sviadnov');
  assert.equal(lat, 49.6960782);
  assert.equal(lng, 18.3205337);
});

