import test from 'node:test';
import assert from 'node:assert/strict';
import type { ElectionRemovalPoint } from '@prisma/client';
import {
  calculateMediaLoadSlots,
  calculateServiceMinutes,
  DEFAULT_VEHICLE_CAPACITY_SLOTS,
} from '../lib/election-removal/constants';
import { convertElectionPointToJob } from '../lib/election-removal/planning';
import { planFieldWork } from '../lib/field-planning/planning-engine';
import type { PlanningInput, PlanningProfile, TravelLeg } from '../lib/field-planning/contracts';
import { analyzeCampaignTelemetry, calculatePointTelemetry } from '../lib/election-removal/ai-telemetry';

const mockDepot = { latitude: 50.08804, longitude: 14.42076 };

const mockProfileWithCapacity: PlanningProfile = {
  timezone: 'Europe/Prague',
  country: 'CZ',
  depot: mockDepot,
  endLocation: mockDepot,
  workdayStart: '07:30',
  workdayEnd: '19:00',
  breakMinutes: 30,
  overtimeMinutes: 240,
  flexibleHours: true,
  strategy: 'BALANCED',
  serviceMinutes: {
    ELECTION_REMOVAL: 5,
  },
  fallbackSpeedKph: 50,
  fallbackDistanceFactor: 1.3,
  maximumJobsPerRoute: 50,
  vehicleRequired: false,
  requireHumanApproval: true,
  enabled: true,
  vehicleCapacitySlots: 30, // 30 Áček or 5 MiniTowerů or 1 Tower
  warehouseUnloadMinutes: 15,
};

const mockTravelProvider = async (): Promise<TravelLeg> => ({
  distanceMeters: 2000,
  durationSeconds: 180, // 3 min
  estimated: true,
  polyline: '',
});

test('Capacity model: calculates load slots correctly for different media and operations', () => {
  // Áčko: 1 slot
  assert.equal(calculateMediaLoadSlots('ACKO', 'FULL_REMOVAL', 1), 1);
  assert.equal(calculateMediaLoadSlots('ACKO', 'FULL_REMOVAL', 30), 30);

  // MiniTower: 6 slots (5 MiniTowerů = 30 slots)
  assert.equal(calculateMediaLoadSlots('MINI_TOWER', 'FULL_REMOVAL', 1), 6);
  assert.equal(calculateMediaLoadSlots('MINI_TOWER', 'FULL_REMOVAL', 5), 30);

  // Big Tower: 30 slots (1 Tower = 30 slots)
  assert.equal(calculateMediaLoadSlots('TOWER', 'FULL_REMOVAL', 1), 30);

  // Banner change (výměna plachty): 0 slots
  assert.equal(calculateMediaLoadSlots('TOWER', 'BANNER_CHANGE', 1), 0);
  assert.equal(calculateMediaLoadSlots('MINI_TOWER', 'BANNER_CHANGE', 1), 0);
});

test('Service times: Banner change is faster than full tower deinstallation', () => {
  const fullTower = calculateServiceMinutes('TOWER', 1, null, 'FULL_REMOVAL');
  const bannerChangeTower = calculateServiceMinutes('TOWER', 1, null, 'BANNER_CHANGE');

  assert.ok(bannerChangeTower.totalMinutes < fullTower.totalMinutes);
  assert.equal(bannerChangeTower.totalMinutes, 7);
  assert.equal(fullTower.totalMinutes, 15);
});

test('Multi-Trip Routing: Automatically inserts warehouse unload pitstop when vehicle capacity of 30 is exceeded', async () => {
  const campaign = {
    id: 'camp-capacity-1',
    name: 'Kampaň Svoz Áček',
    targetDate: new Date('2026-10-15T00:00:00Z'),
    createdAt: new Date('2026-10-06T09:00:00Z'),
  };

  // Generate 32 Áček points (capacity is 30)
  const points: ElectionRemovalPoint[] = [];
  for (let i = 1; i <= 32; i++) {
    points.push({
      id: `pt-acko-${i}`,
      organizationId: 'org-1',
      campaignId: campaign.id,
      mediaType: 'ACKO',
      label: `Áčko #${i}`,
      latitude: 50.08 + (i * 0.001),
      longitude: 14.42 + (i * 0.001),
      quantity: 1,
      serviceMinutes: 3,
      status: 'PENDING',
      updatedAt: new Date('2026-10-06T10:00:00Z'),
    } as unknown as ElectionRemovalPoint);
  }

  const jobs = points.map((p) => convertElectionPointToJob(p, campaign));

  const input: PlanningInput = {
    organizationId: 'org-1',
    date: '2026-10-15',
    now: '2026-10-15T07:30:00.000Z',
    profile: mockProfileWithCapacity,
    jobs,
    employees: [
      {
        id: 'emp-1',
        organizationId: 'org-1',
        name: 'Jan Novák',
        userId: 'u1',
        isActive: true,
        positions: [],
        roles: ['WORKER'],
        available: true,
      },
    ],
    vehicles: [
      {
        id: 'veh-1',
        organizationId: 'org-1',
        name: 'Dodávka s vlekem',
        status: 'AVAILABLE',
        reserved: false,
      },
    ],
    crews: [
      {
        id: 'crew-1',
        employeeIds: ['emp-1'],
        vehicleId: 'veh-1',
      },
    ],
  };

  const result = await planFieldWork(input, mockTravelProvider);

  assert.equal(result.crews.length, 1);
  const crew = result.crews[0];

  // Look for the warehouse pitstop
  const pitstops = crew.stops.filter((s) => s.isWarehousePitstop || s.workType === 'WAREHOUSE_UNLOAD');
  assert.equal(pitstops.length, 1, 'Musí být vložena právě 1 mezizastávka na centrálním skladě');

  const pitstop = pitstops[0];
  assert.equal(pitstop.serviceMinutes, 15, 'Doba vykládky na skladě musí být 15 min');
  assert.equal(pitstop.unloadedSlots, 30, 'Předchozí náklad 30 Áček musí být vyložen');
});

test('Multi-Trip Routing: 5 MiniTowerů (6 slots each) fit on 1 load, 6th MiniTower triggers warehouse pitstop', async () => {
  const campaign = {
    id: 'camp-capacity-2',
    name: 'Kampaň MiniTowery',
    targetDate: new Date('2026-10-15T00:00:00Z'),
    createdAt: new Date('2026-10-06T09:00:00Z'),
  };

  // 6 MiniTowerů: each is 6 slots. Total 36 slots -> requires warehouse pitstop after 5!
  const points: ElectionRemovalPoint[] = [];
  for (let i = 1; i <= 6; i++) {
    points.push({
      id: `pt-mini-${i}`,
      organizationId: 'org-1',
      campaignId: campaign.id,
      mediaType: 'MINI_TOWER',
      label: `MiniTower #${i}`,
      latitude: 50.08 + (i * 0.002),
      longitude: 14.42 + (i * 0.002),
      quantity: 1,
      serviceMinutes: 10,
      status: 'PENDING',
      updatedAt: new Date('2026-10-06T10:00:00Z'),
    } as unknown as ElectionRemovalPoint);
  }

  const jobs = points.map((p) => convertElectionPointToJob(p, campaign));

  const input: PlanningInput = {
    organizationId: 'org-1',
    date: '2026-10-15',
    now: '2026-10-15T07:30:00.000Z',
    profile: mockProfileWithCapacity,
    jobs,
    employees: [
      {
        id: 'emp-1',
        organizationId: 'org-1',
        name: 'Petr Svoboda',
        userId: 'u1',
        isActive: true,
        positions: [],
        roles: ['WORKER'],
        available: true,
      },
    ],
    vehicles: [
      {
        id: 'veh-1',
        organizationId: 'org-1',
        name: 'Valník',
        status: 'AVAILABLE',
        reserved: false,
      },
    ],
    crews: [
      {
        id: 'crew-1',
        employeeIds: ['emp-1'],
        vehicleId: 'veh-1',
      },
    ],
  };

  const result = await planFieldWork(input, mockTravelProvider);
  const crew = result.crews[0];
  const pitstops = crew.stops.filter((s) => s.isWarehousePitstop || s.workType === 'WAREHOUSE_UNLOAD');

  assert.equal(pitstops.length, 1, 'Musí být vložena vykládka na skladě po 5 MiniTowerech (30 slotech)');
  assert.equal(pitstops[0].unloadedSlots, 30);
});

test('Multi-Trip Routing: Banner change (0 slots) never triggers warehouse pitstop', async () => {
  const campaign = {
    id: 'camp-capacity-3',
    name: 'Kampaň Výměna Plachet',
    targetDate: new Date('2026-10-15T00:00:00Z'),
    createdAt: new Date('2026-10-06T09:00:00Z'),
  };

  // 10 towers where only banners are changed (0 slots each)
  const points: ElectionRemovalPoint[] = [];
  for (let i = 1; i <= 10; i++) {
    points.push({
      id: `pt-banner-${i}`,
      organizationId: 'org-1',
      campaignId: campaign.id,
      mediaType: 'TOWER',
      label: `Výměna plachty #${i}`,
      description: 'Výměna plachty na věži',
      layerName: 'Výměna plachet',
      latitude: 50.08 + (i * 0.001),
      longitude: 14.42 + (i * 0.001),
      quantity: 1,
      serviceMinutes: 8,
      status: 'PENDING',
      updatedAt: new Date('2026-10-06T10:00:00Z'),
    } as unknown as ElectionRemovalPoint);
  }

  const jobs = points.map((p) => convertElectionPointToJob(p, campaign));
  // Verify 0 load slots
  assert.equal(jobs[0].loadSlots, 0);

  const input: PlanningInput = {
    organizationId: 'org-1',
    date: '2026-10-15',
    now: '2026-10-15T07:30:00.000Z',
    profile: mockProfileWithCapacity,
    jobs,
    employees: [
      {
        id: 'emp-1',
        organizationId: 'org-1',
        name: 'Jan Technik',
        userId: 'u1',
        isActive: true,
        positions: [],
        roles: ['TECHNICIAN'],
        available: true,
      },
    ],
    vehicles: [
      {
        id: 'veh-1',
        organizationId: 'org-1',
        name: 'Osobák',
        status: 'AVAILABLE',
        reserved: false,
      },
    ],
    crews: [
      {
        id: 'crew-1',
        employeeIds: ['emp-1'],
        vehicleId: 'veh-1',
      },
    ],
  };

  const result = await planFieldWork(input, mockTravelProvider);
  const crew = result.crews[0];
  const pitstops = crew.stops.filter((s) => s.isWarehousePitstop || s.workType === 'WAREHOUSE_UNLOAD');

  assert.equal(pitstops.length, 0, 'Výměny plachet nesmí vyvolat žádný přejezd na sklad');
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

test('Single-Medium Rule: Áčka and MiniTower are never loaded together without warehouse unload pitstop', async () => {
  const campaign = {
    id: 'camp-single-medium',
    name: 'Kampaň Oddělený svoz',
    targetDate: new Date('2026-10-15T00:00:00Z'),
    createdAt: new Date('2026-10-06T09:00:00Z'),
  };

  // 3 Áčka (3 slots) and 1 MiniTower (6 slots).
  // Total slots = 9 slots (far below 30 limit).
  // BUT because different media cannot be mixed on the same vehicle load,
  // the crew must visit the warehouse to unload Áčka before picking up the MiniTower!
  const ackoPoints: ElectionRemovalPoint[] = [1, 2, 3].map((i) => ({
    id: `pt-acko-${i}`,
    organizationId: 'org-1',
    campaignId: campaign.id,
    mediaType: 'ACKO',
    label: `Áčko #${i}`,
    latitude: 50.08 + (i * 0.001),
    longitude: 14.42 + (i * 0.001),
    quantity: 1,
    serviceMinutes: 5,
    status: 'PENDING',
    updatedAt: new Date('2026-10-06T10:00:00Z'),
  } as unknown as ElectionRemovalPoint));

  const miniTowerPoint: ElectionRemovalPoint = {
    id: 'pt-mini-single',
    organizationId: 'org-1',
    campaignId: campaign.id,
    mediaType: 'MINI_TOWER',
    label: 'MiniTower #1',
    latitude: 50.085,
    longitude: 14.425,
    quantity: 1,
    serviceMinutes: 10,
    status: 'PENDING',
    updatedAt: new Date('2026-10-06T10:00:00Z'),
  } as unknown as ElectionRemovalPoint;

  const jobs = [...ackoPoints, miniTowerPoint].map((p) => convertElectionPointToJob(p, campaign));

  const input: PlanningInput = {
    organizationId: 'org-1',
    date: '2026-10-15',
    now: '2026-10-15T07:30:00.000Z',
    profile: mockProfileWithCapacity,
    jobs,
    employees: [
      {
        id: 'emp-1',
        organizationId: 'org-1',
        name: 'Jan Technik',
        userId: 'u1',
        isActive: true,
        positions: [],
        roles: ['WORKER'],
        available: true,
      },
    ],
    vehicles: [
      {
        id: 'veh-1',
        organizationId: 'org-1',
        name: 'Vozidlo',
        status: 'AVAILABLE',
        reserved: false,
      },
    ],
    crews: [
      {
        id: 'crew-1',
        employeeIds: ['emp-1'],
        vehicleId: 'veh-1',
      },
    ],
  };

  const result = await planFieldWork(input, mockTravelProvider);
  const crew = result.crews[0];
  const pitstops = crew.stops.filter((s) => s.isWarehousePitstop || s.workType === 'WAREHOUSE_UNLOAD');

  assert.equal(pitstops.length, 1, 'Musí být vložena vykládka na skladě při přechodu z Áček na MiniTower');
  assert.ok(pitstops[0].reason.includes('Změna typu média') || pitstops[0].reason.includes('Změna média'));
});

test('RELOCATION: calculates relocation service times and differentiates from warehouse removal', () => {
  const fullTower = calculateServiceMinutes('TOWER', 1, null, 'FULL_REMOVAL');
  const bannerChangeTower = calculateServiceMinutes('TOWER', 1, null, 'BANNER_CHANGE');
  const relocationTower = calculateServiceMinutes('TOWER', 1, null, 'RELOCATION');

  // Demontáž na sklad = 15m, výměna plachty = 7m, přemístění na jiné místo (demontáž + instalace) = 25m
  assert.equal(bannerChangeTower.totalMinutes, 7);
  assert.equal(fullTower.totalMinutes, 15);
  assert.equal(relocationTower.totalMinutes, 25);
  assert.ok(relocationTower.totalMinutes > fullTower.totalMinutes);

  const fullAcko = calculateServiceMinutes('ACKO', 1, null, 'FULL_REMOVAL');
  const bannerChangeAcko = calculateServiceMinutes('ACKO', 1, null, 'BANNER_CHANGE');
  const relocationAcko = calculateServiceMinutes('ACKO', 1, null, 'RELOCATION');

  assert.equal(bannerChangeAcko.totalMinutes, 4);
  assert.equal(fullAcko.totalMinutes, 5);
  assert.equal(relocationAcko.totalMinutes, 8);
});

test('RELOCATION: direct relocation does not trigger warehouse unload pitstop', async () => {
  const campaign = {
    id: 'camp-relocation',
    name: 'Kampaň Převoz konstrukcí',
    targetDate: new Date('2026-10-15T00:00:00Z'),
    createdAt: new Date('2026-10-06T09:00:00Z'),
  };

  const points: ElectionRemovalPoint[] = [1, 2].map((i) => ({
    id: `pt-reloc-${i}`,
    organizationId: 'org-1',
    campaignId: campaign.id,
    mediaType: 'MINI_TOWER',
    label: `Převoz MiniTower #${i}`,
    description: 'Převoz na jiné místo (ul. Nádražní)',
    latitude: 50.08 + (i * 0.002),
    longitude: 14.42 + (i * 0.002),
    quantity: 1,
    status: 'PENDING',
    updatedAt: new Date('2026-10-06T10:00:00Z'),
  } as unknown as ElectionRemovalPoint));

  const jobs = points.map((p) => convertElectionPointToJob(p, campaign));
  assert.equal(jobs[0].operationType, 'RELOCATION');

  const input: PlanningInput = {
    organizationId: 'org-1',
    date: '2026-10-15',
    now: '2026-10-15T07:30:00.000Z',
    profile: mockProfileWithCapacity,
    jobs,
    employees: [
      {
        id: 'emp-1',
        organizationId: 'org-1',
        name: 'Jan Technik',
        userId: 'u1',
        isActive: true,
        positions: [],
        roles: ['WORKER'],
        available: true,
      },
    ],
    vehicles: [
      {
        id: 'veh-1',
        organizationId: 'org-1',
        name: 'Vozidlo',
        status: 'AVAILABLE',
        reserved: false,
      },
    ],
    crews: [
      {
        id: 'crew-1',
        employeeIds: ['emp-1'],
        vehicleId: 'veh-1',
      },
    ],
  };

  const result = await planFieldWork(input, mockTravelProvider);
  const crew = result.crews[0];
  const pitstops = crew.stops.filter((s) => s.isWarehousePitstop || s.workType === 'WAREHOUSE_UNLOAD');

  assert.equal(pitstops.length, 0, 'Přímý převoz na jiné místo nesmí vyvolat mezizastávku pro vykládku na skladě');
});

