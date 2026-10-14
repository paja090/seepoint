import type { PlanningInput, PlanningJob } from '../../lib/field-planning/contracts';
const location = { latitude: 50, longitude: 14 };
export function input(jobs: PlanningJob[]): PlanningInput {
  return { organizationId: 'org', date: '2026-10-20', now: '2026-10-20T05:00:00Z',
    profile: { timezone: 'Europe/Prague', country: 'CZ', depot: location, endLocation: location, workdayStart: '07:00', workdayEnd: '16:00',
      breakMinutes: 30, overtimeMinutes: 0, strategy: 'BALANCED', serviceMinutes: { ELECTION_REMOVAL: 10 }, fallbackSpeedKph: 50, fallbackDistanceFactor: 1.3,
      maximumJobsPerRoute: 50, vehicleRequired: true, requireHumanApproval: true, enabled: true, vehicleCapacitySlots: 30, warehouseUnloadMinutes: 15 },
    jobs, employees: [{ id: 'worker', organizationId: 'org', name: 'Worker', userId: 'user', isActive: true, positions: [], roles: ['WORKER'], available: true }],
    vehicles: [{ id: 'car', organizationId: 'org', name: 'Car', status: 'AVAILABLE', reserved: false, capacitySlots: 30, equipment: [] }],
    crews: [{ id: 'crew', employeeIds: ['worker'], vehicleId: 'car' }] };
}
export const job = (extra: Partial<PlanningJob> = {}): PlanningJob => ({ id: 'job', organizationId: 'org', title: 'Task', workType: 'ELECTION_REMOVAL',
  status: 'PLANNED', priority: 'NORMAL', scheduledAt: '2026-10-20T05:00:00Z', updatedAt: '2026-10-20T05:00:00Z', location, serviceMinutes: 10, loadSlots: 0, constraints: {}, ...extra });
export const travel = async () => ({ distanceMeters: 1000, durationSeconds: 600, estimated: false, polyline: '' });
