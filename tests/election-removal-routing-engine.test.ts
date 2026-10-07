import test from 'node:test';
import assert from 'node:assert/strict';
import type { ElectionRemovalPoint } from '@prisma/client';
import { convertElectionPointToJob } from '../lib/election-removal/planning';
import { planFieldWork } from '../lib/field-planning/planning-engine';
import type { PlanningInput, PlanningProfile, TravelLeg } from '../lib/field-planning/contracts';

const mockProfile: PlanningProfile = {
  timezone: 'Europe/Prague',
  country: 'CZ',
  depot: { latitude: 50.08804, longitude: 14.42076 },
  endLocation: { latitude: 50.08804, longitude: 14.42076 },
  workdayStart: '07:30',
  workdayEnd: '16:00',
  breakMinutes: 30,
  overtimeMinutes: 60,
  strategy: 'BALANCED',
  serviceMinutes: {
    ELECTION_REMOVAL: 10,
  },
  fallbackSpeedKph: 50,
  fallbackDistanceFactor: 1.3,
  maximumJobsPerRoute: 50,
  vehicleRequired: false,
  requireHumanApproval: true,
  enabled: true,
};

test('convertElectionPointToJob: converts point to PlanningJob with independent media service time', () => {
  const mockPointA = {
    id: 'pt-acko-1',
    organizationId: 'org-test',
    campaignId: 'camp-1',
    mediaType: 'ACKO',
    label: 'Áčko Náměstí',
    description: 'Před radnicí',
    latitude: 50.088,
    longitude: 14.42,
    quantity: 1,
    serviceMinutes: 5,
    status: 'PENDING',
    updatedAt: new Date('2026-10-06T10:00:00Z'),
  } as unknown as ElectionRemovalPoint;

  const mockPointB = {
    id: 'pt-tower-1',
    organizationId: 'org-test',
    campaignId: 'camp-1',
    mediaType: 'TOWER',
    label: 'Tower Náměstí',
    description: 'Vedle kašny',
    latitude: 50.088,
    longitude: 14.42,
    quantity: 1,
    serviceMinutes: 15,
    status: 'PENDING',
    updatedAt: new Date('2026-10-06T10:00:00Z'),
  } as unknown as ElectionRemovalPoint;

  const campaign = {
    id: 'camp-1',
    name: 'Volby 2026',
    targetDate: new Date('2026-10-15T00:00:00Z'),
    createdAt: new Date('2026-10-06T09:00:00Z'),
  };

  const jobA = convertElectionPointToJob(mockPointA, campaign);
  const jobB = convertElectionPointToJob(mockPointB, campaign);

  assert.equal(jobA.id, 'election-point:pt-acko-1');
  assert.equal(jobA.sourceType, 'ELECTION_REMOVAL_POINT');
  assert.equal(jobA.electionRemovalPointId, 'pt-acko-1');
  assert.equal(jobA.mediaType, 'ACKO');
  assert.equal(jobA.serviceMinutes, 5);

  assert.equal(jobB.id, 'election-point:pt-tower-1');
  assert.equal(jobB.sourceType, 'ELECTION_REMOVAL_POINT');
  assert.equal(jobB.electionRemovalPointId, 'pt-tower-1');
  assert.equal(jobB.mediaType, 'TOWER');
  assert.equal(jobB.serviceMinutes, 15);

  // Both share coordinates but remain separate jobs
  assert.equal(jobA.location?.latitude, jobB.location?.latitude);
  assert.notEqual(jobA.id, jobB.id);
});

test('Smart Routing: divides election removal points between crews and clusters identical GPS items', async () => {
  const campaign = {
    id: 'camp-1',
    name: 'Volby 2026',
    targetDate: new Date('2026-10-15T00:00:00Z'),
    createdAt: new Date('2026-10-06T09:00:00Z'),
  };

  // 4 items:
  // Item 1: Áčko at Location X (50.088, 14.420), 5 min
  // Item 2: Tower at Location X (50.088, 14.420) - SAME GPS!, 15 min
  // Item 3: Banner at Location Y (50.095, 14.430), 10 min
  // Item 4: Bench at Location Z (50.070, 14.410), 5 min
  const points = [
    {
      id: 'pt-1',
      organizationId: 'org-test',
      campaignId: 'camp-1',
      mediaType: 'ACKO',
      label: 'Áčko Radnice',
      latitude: 50.088,
      longitude: 14.42,
      quantity: 1,
      serviceMinutes: 5,
      status: 'PENDING',
      updatedAt: new Date('2026-10-06T10:00:00Z'),
    },
    {
      id: 'pt-2',
      organizationId: 'org-test',
      campaignId: 'camp-1',
      mediaType: 'TOWER',
      label: 'Tower Radnice (Stejné GPS)',
      latitude: 50.088,
      longitude: 14.42,
      quantity: 1,
      serviceMinutes: 15,
      status: 'PENDING',
      updatedAt: new Date('2026-10-06T10:00:00Z'),
    },
    {
      id: 'pt-3',
      organizationId: 'org-test',
      campaignId: 'camp-1',
      mediaType: 'BANNER',
      label: 'Banner Most',
      latitude: 50.095,
      longitude: 14.43,
      quantity: 1,
      serviceMinutes: 10,
      status: 'PENDING',
      updatedAt: new Date('2026-10-06T10:00:00Z'),
    },
    {
      id: 'pt-4',
      organizationId: 'org-test',
      campaignId: 'camp-1',
      mediaType: 'BENCH',
      label: 'Lavička Nádraží',
      latitude: 50.07,
      longitude: 14.41,
      quantity: 1,
      serviceMinutes: 5,
      status: 'PENDING',
      updatedAt: new Date('2026-10-06T10:00:00Z'),
    },
  ] as unknown as ElectionRemovalPoint[];

  const jobs = points.map((p) => convertElectionPointToJob(p, campaign));

  const employees = [
    { id: 'emp-1', organizationId: 'org-test', name: 'Jan Novák', userId: 'user-1', isActive: true, roles: ['WORKER'], positions: ['MONTÉR'], available: true },
    { id: 'emp-2', organizationId: 'org-test', name: 'Petr Svoboda', userId: 'user-2', isActive: true, roles: ['WORKER'], positions: ['MONTÉR'], available: true },
  ];

  const vehicles = [
    { id: 'veh-1', organizationId: 'org-test', name: 'Dodávka A', status: 'ACTIVE', reserved: false },
    { id: 'veh-2', organizationId: 'org-test', name: 'Dodávka B', status: 'ACTIVE', reserved: false },
  ];

  const crews = [
    { id: 'crew-1', employeeIds: ['emp-1'], vehicleId: 'veh-1' },
    { id: 'crew-2', employeeIds: ['emp-2'], vehicleId: 'veh-2' },
  ];

  const input: PlanningInput = {
    organizationId: 'org-test',
    date: '2026-10-15',
    now: '2026-10-15T07:30:00.000Z',
    profile: mockProfile,
    jobs,
    employees,
    vehicles,
    crews,
  };

  // Mock travel provider (Euclidean / haversine based travel)
  const travelProvider = async (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): Promise<TravelLeg> => {
    if (from.latitude === to.latitude && from.longitude === to.longitude) {
      return { distanceMeters: 0, durationSeconds: 0, estimated: false, polyline: '' };
    }
    return { distanceMeters: 2000, durationSeconds: 300, estimated: true, polyline: '' };
  };

  const result = await planFieldWork(input, travelProvider);

  // All 4 items must be planned
  const totalStops = result.crews.reduce((acc, c) => acc + c.stops.length, 0);
  assert.equal(totalStops, 4);
  assert.equal(result.unassigned.length, 0);

  // Find where pt-1 and pt-2 landed
  const allStops = result.crews.flatMap((c) => c.stops);
  const stop1 = allStops.find((s) => s.electionRemovalPointId === 'pt-1')!;
  const stop2 = allStops.find((s) => s.electionRemovalPointId === 'pt-2')!;

  assert.ok(stop1);
  assert.ok(stop2);
  assert.equal(stop1.serviceMinutes, 5);
  assert.equal(stop2.serviceMinutes, 15);
  assert.equal(stop1.sourceType, 'ELECTION_REMOVAL_POINT');
  assert.equal(stop2.sourceType, 'ELECTION_REMOVAL_POINT');

  // Both have identical GPS
  assert.equal(stop1.location.latitude, stop2.location.latitude);
  assert.equal(stop1.location.longitude, stop2.location.longitude);

  // If both landed in the same crew, travel between them must be 0 meters / 0 seconds
  const crewWithStop1 = result.crews.find((c) => c.stops.some((s) => s.electionRemovalPointId === 'pt-1'))!;
  if (crewWithStop1.stops.some((s) => s.electionRemovalPointId === 'pt-2')) {
    const idx1 = crewWithStop1.stops.findIndex((s) => s.electionRemovalPointId === 'pt-1');
    const idx2 = crewWithStop1.stops.findIndex((s) => s.electionRemovalPointId === 'pt-2');
    const consecutive = Math.abs(idx1 - idx2) === 1;
    if (consecutive) {
      const secondStop = idx1 < idx2 ? crewWithStop1.stops[idx2] : crewWithStop1.stops[idx1];
      assert.equal(secondStop.travel.distanceMeters, 0);
      assert.equal(secondStop.travel.durationSeconds, 0);
    }
  }
});
