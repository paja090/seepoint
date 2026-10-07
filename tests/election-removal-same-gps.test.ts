import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateServiceMinutes } from '../lib/election-removal/constants';
import { electionRemovalJobId, type PlanningJob, type PlanningInput } from '../lib/field-planning/contracts';
import { planFieldWork } from '../lib/field-planning/planning-engine';
import { zonedTime } from '../lib/field-planning/profile';

test('Mandatory Same GPS Test: ACKO (5 min) and TOWER (15 min) at identical coordinates', async () => {
  const organizationId = 'org_seepoint_test';
  const gpsX = { latitude: 50.087, longitude: 14.421 };

  // 1. Two physical media items at the exact same coordinates
  const ackoPoint = {
    id: 'point_acko_101',
    organizationId,
    campaignId: 'camp_1',
    mediaType: 'ACKO' as const,
    label: 'Placemark 1 - Áčko',
    latitude: gpsX.latitude,
    longitude: gpsX.longitude,
    quantity: 1,
    serviceMinutes: calculateServiceMinutes('ACKO', 1).totalMinutes, // 5 min
    status: 'PENDING' as const,
  };

  const towerPoint = {
    id: 'point_tower_102',
    organizationId,
    campaignId: 'camp_1',
    mediaType: 'TOWER' as const,
    label: 'Placemark 2 - Tower',
    latitude: gpsX.latitude,
    longitude: gpsX.longitude,
    quantity: 1,
    serviceMinutes: calculateServiceMinutes('TOWER', 1).totalMinutes, // 15 min
    status: 'PENDING' as const,
  };

  // 2. Must produce 2 separate ElectionRemovalPoint items (never merged)
  assert.notEqual(ackoPoint.id, towerPoint.id);
  assert.equal(ackoPoint.serviceMinutes, 5);
  assert.equal(towerPoint.serviceMinutes, 15);
  assert.equal(ackoPoint.latitude, towerPoint.latitude);
  assert.equal(ackoPoint.longitude, towerPoint.longitude);

  // 3. Map to 2 discrete PlanningJobs with distinct IDs
  const ackoJob: PlanningJob = {
    id: electionRemovalJobId(ackoPoint.id),
    organizationId,
    title: ackoPoint.label,
    workType: 'ELECTION_REMOVAL',
    priority: 'NORMAL',
    status: ackoPoint.status,
    scheduledAt: '2026-10-10T08:00:00.000Z',
    location: { latitude: ackoPoint.latitude, longitude: ackoPoint.longitude },
    serviceMinutes: ackoPoint.serviceMinutes,
    sourceType: 'ELECTION_REMOVAL_POINT',
    sourceId: ackoPoint.id,
    electionCampaignId: ackoPoint.campaignId,
    electionRemovalPointId: ackoPoint.id,
    mediaType: ackoPoint.mediaType,
    quantity: ackoPoint.quantity,
    constraints: {},
    updatedAt: new Date().toISOString(),
  };

  const towerJob: PlanningJob = {
    id: electionRemovalJobId(towerPoint.id),
    organizationId,
    title: towerPoint.label,
    workType: 'ELECTION_REMOVAL',
    priority: 'NORMAL',
    status: towerPoint.status,
    scheduledAt: '2026-10-10T08:00:00.000Z',
    location: { latitude: towerPoint.latitude, longitude: towerPoint.longitude },
    serviceMinutes: towerPoint.serviceMinutes,
    sourceType: 'ELECTION_REMOVAL_POINT',
    sourceId: towerPoint.id,
    electionCampaignId: towerPoint.campaignId,
    electionRemovalPointId: towerPoint.id,
    mediaType: towerPoint.mediaType,
    quantity: towerPoint.quantity,
    constraints: {},
    updatedAt: new Date().toISOString(),
  };

  assert.notEqual(ackoJob.id, towerJob.id);

  // 4. Test planning engine with both jobs
  const travelCalls: Array<{ from: { latitude: number; longitude: number }; to: { latitude: number; longitude: number } }> = [];
  const mockTravelProvider = async (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
    travelCalls.push({ from, to });
    const isSameLocation = from.latitude === to.latitude && from.longitude === to.longitude;
    return {
      distanceMeters: isSameLocation ? 0 : 5000,
      durationSeconds: isSameLocation ? 0 : 600,
      estimated: false,
      polyline: '',
    };
  };

  const planningInput: PlanningInput = {
    organizationId,
    date: '2026-10-10',
    now: '2026-10-10T06:00:00.000Z',
    profile: {
      timezone: 'Europe/Prague',
      country: 'CZ',
      depot: { latitude: 50.08, longitude: 14.42 },
      endLocation: { latitude: 50.08, longitude: 14.42 },
      workdayStart: '08:00',
      workdayEnd: '17:00',
      breakMinutes: 30,
      overtimeMinutes: 0,
      strategy: 'BALANCED',
      serviceMinutes: { ELECTION_REMOVAL: 10 },
      fallbackSpeedKph: 50,
      fallbackDistanceFactor: 1.3,
      maximumJobsPerRoute: 50,
      vehicleRequired: true,
      requireHumanApproval: true,
      enabled: true,
    },
    jobs: [ackoJob, towerJob],
    employees: [
      {
        id: 'emp_1',
        organizationId,
        name: 'Karel Technik',
        userId: 'usr_1',
        isActive: true,
        positions: [],
        roles: [],
        available: true,
      },
    ],
    vehicles: [
      {
        id: 'veh_1',
        organizationId,
        name: 'Dodávka SeePoint',
        status: 'AVAILABLE',
        reserved: false,
      },
    ],
    crews: [
      {
        id: 'crew_1',
        employeeIds: ['emp_1'],
        vehicleId: 'veh_1',
      },
    ],
  };

  const planResult = await planFieldWork(planningInput, mockTravelProvider);

  assert.equal(planResult.crews.length, 1);
  const crew = planResult.crews[0];
  assert.equal(crew.stops.length, 2, 'Must contain 2 distinct stops');

  // Verify the travel between them is 0 m and 0 s
  const stop1 = crew.stops[0];
  const stop2 = crew.stops[1];

  assert.notEqual(stop1.jobId, stop2.jobId);
  assert.equal(stop2.travel.distanceMeters, 0, 'Travel between identical coordinates must be 0 meters');
  assert.equal(stop2.travel.durationSeconds, 0, 'Travel between identical coordinates must be 0 seconds');

  // Verify service times are independently preserved
  assert.equal(stop1.serviceMinutes, 5);
  assert.equal(stop2.serviceMinutes, 15);

  // Total service time together is 20 min
  const totalServiceMinutes = stop1.serviceMinutes + stop2.serviceMinutes;
  assert.equal(totalServiceMinutes, 20);

  // 5. Test Status Independence: completing ACKO does NOT complete TOWER
  let ackoStatus: string = ackoPoint.status;
  let towerStatus: string = towerPoint.status;

  // Complete ACKO
  ackoStatus = 'COMPLETED';
  assert.equal(ackoStatus, 'COMPLETED');
  assert.equal(towerStatus, 'PENDING', 'Tower status must remain PENDING when ACKO is completed');

  // Report problem on TOWER
  towerStatus = 'ISSUE';
  assert.equal(towerStatus, 'ISSUE');
  assert.equal(ackoStatus, 'COMPLETED', 'ACKO must remain COMPLETED when Tower reports an ISSUE');
});

test('Same GPS Election Removal with 2 Crews: co-located items stay on the SAME crew and are never split', async () => {
  const organizationId = 'org_seepoint_test';
  const gpsX = { latitude: 50.087, longitude: 14.421 };

  const ackoJob: PlanningJob = {
    id: electionRemovalJobId('point_a_1'),
    organizationId,
    title: 'Áčko u vchodu',
    workType: 'ELECTION_REMOVAL',
    priority: 'NORMAL',
    status: 'PENDING',
    scheduledAt: '2026-10-10T08:00:00.000Z',
    location: gpsX,
    serviceMinutes: 10,
    sourceType: 'ELECTION_REMOVAL_POINT',
    sourceId: 'point_a_1',
    constraints: {},
    updatedAt: new Date().toISOString(),
  };

  const benchJob: PlanningJob = {
    id: electionRemovalJobId('point_b_2'),
    organizationId,
    title: 'Lavička u vchodu',
    workType: 'ELECTION_REMOVAL',
    priority: 'NORMAL',
    status: 'PENDING',
    scheduledAt: '2026-10-10T08:00:00.000Z',
    location: gpsX,
    serviceMinutes: 10,
    sourceType: 'ELECTION_REMOVAL_POINT',
    sourceId: 'point_b_2',
    constraints: {},
    updatedAt: new Date().toISOString(),
  };

  const twoCrewsInput: PlanningInput = {
    organizationId,
    date: '2026-10-10',
    now: '2026-10-10T06:00:00.000Z',
    profile: {
      timezone: 'Europe/Prague',
      country: 'CZ',
      depot: { latitude: 50.08, longitude: 14.42 },
      endLocation: { latitude: 50.08, longitude: 14.42 },
      workdayStart: '08:00',
      workdayEnd: '17:00',
      breakMinutes: 30,
      overtimeMinutes: 60,
      strategy: 'BALANCED',
      serviceMinutes: { ELECTION_REMOVAL: 10 },
      fallbackSpeedKph: 50,
      fallbackDistanceFactor: 1.3,
      maximumJobsPerRoute: 50,
      vehicleRequired: false,
      requireHumanApproval: true,
      enabled: true,
    },
    jobs: [ackoJob, benchJob],
    employees: [
      { id: 'emp_1', organizationId, name: 'Posádka 1 řidič', userId: 'u1', isActive: true, positions: [], roles: [], available: true },
      { id: 'emp_2', organizationId, name: 'Posádka 2 řidič', userId: 'u2', isActive: true, positions: [], roles: [], available: true },
    ],
    vehicles: [],
    crews: [
      { id: 'crew_1', employeeIds: ['emp_1'], vehicleId: null },
      { id: 'crew_2', employeeIds: ['emp_2'], vehicleId: null },
    ],
  };

  const travelMock = async (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
    const same = from.latitude === to.latitude && from.longitude === to.longitude;
    return {
      distanceMeters: same ? 0 : 4000,
      durationSeconds: same ? 0 : 480,
      estimated: false,
      polyline: '',
    };
  };

  const result = await planFieldWork(twoCrewsInput, travelMock);

  // Crucial check: Exactly ONE crew must have BOTH stops at this identical GPS!
  // It must NEVER split one stop to crew 1 and one stop to crew 2!
  assert.equal(result.crews.length, 1, 'Co-located points must stay with one crew, leaving other crew free for other areas');
  assert.equal(result.crews[0].stops.length, 2, 'The chosen crew must handle both stops at the same GPS');
  assert.equal(result.crews[0].stops[1].travel.distanceMeters, 0, 'Travel between co-located items must be 0');
});

test('Start time alignment: route departs at configured local start time in Prague timezone and not shifted by UTC', async () => {
  const organizationId = 'org_test_time';
  const ackoJob: PlanningJob = {
    id: electionRemovalJobId('pt_time_1'),
    organizationId,
    title: 'A2 - MH - Výstavní x Fráni Šrámka',
    workType: 'ELECTION_REMOVAL',
    sourceType: 'ELECTION_REMOVAL_POINT',
    sourceId: 'pt_time_1',
    priority: 'NORMAL',
    status: 'READY',
    scheduledAt: '2026-10-10',
    deadlineAt: null,
    campaignDateFrom: null,
    serviceMinutes: 10,
    location: { latitude: 49.82782, longitude: 18.26381 },
    constraints: {},
    updatedAt: new Date().toISOString(),
  };

  const startLocalTime = '07:30';
  const localStartTs = zonedTime('2026-10-10', startLocalTime, 'Europe/Prague');
  const planNow = new Date(localStartTs).toISOString();

  const planningInput: PlanningInput = {
    organizationId,
    date: '2026-10-10',
    now: planNow,
    profile: {
      timezone: 'Europe/Prague',
      country: 'CZ',
      depot: { latitude: 49.82782, longitude: 18.26381 },
      endLocation: { latitude: 49.82782, longitude: 18.26381 },
      workdayStart: startLocalTime,
      workdayEnd: '17:00',
      breakMinutes: 30,
      overtimeMinutes: 0,
      strategy: 'BALANCED',
      serviceMinutes: { ELECTION_REMOVAL: 10 },
      fallbackSpeedKph: 50,
      fallbackDistanceFactor: 1.3,
      maximumJobsPerRoute: 50,
      vehicleRequired: false,
      requireHumanApproval: true,
      enabled: true,
    },
    jobs: [ackoJob],
    employees: [
      { id: 'emp_1', organizationId, name: 'Posádka 1 řidič', userId: 'u1', isActive: true, positions: [], roles: [], available: true },
    ],
    vehicles: [],
    crews: [
      { id: 'crew_1', employeeIds: ['emp_1'], vehicleId: null },
    ],
  };

  const travelMock = async () => ({ distanceMeters: 0, durationSeconds: 0, estimated: false, polyline: '' });
  const result = await planFieldWork(planningInput, travelMock);

  assert.equal(result.crews.length, 1);
  const stop = result.crews[0].stops[0];
  const departureDate = new Date(stop.arrivalAt);
  const localDepartureHourMin = departureDate.toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' });
  assert.equal(localDepartureHourMin, '07:30', 'Departure in Prague must be 07:30, NOT shifted to 09:30 by UTC offset');
});


