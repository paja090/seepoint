export type Coordinates = { latitude: number; longitude: number };
export type PlanningProfile = {
  navigationPointMinutes?: Record<string, number>;
  timezone: string; country: string | null; depot: Coordinates; endLocation: Coordinates;
  workdayStart: string; workdayEnd: string; breakMinutes: number; overtimeMinutes: number;
  strategy: 'BALANCED' | 'DISTANCE'; serviceMinutes: Record<string, number>;
  fallbackSpeedKph: number; fallbackDistanceFactor: number; maximumJobsPerRoute: number;
  vehicleRequired: boolean; requireHumanApproval: true; enabled: boolean;
};
export type JobConstraints = {
  windowStart?: string; windowEnd?: string; requiredEmployeeIds?: string[];
  requiredPositions?: string[]; predecessorIds?: string[]; vehicleRequired?: boolean;
};
/** Optional for compatibility with persisted V1 WorkOrder snapshots. */
export type PlanningSource = {
  sourceType?: 'WORK_ORDER' | 'WORK_ORDER_ITEM' | 'NAVIGATION_POINT'; sourceId?: string;
  workOrderItemId?: string; carrierId?: string | null; surfaceId?: string | null; crmRealizationId?: string | null;
  parentWorkOrderId?: string; navigationOrderId?: string; navigationPointId?: string;
  clientName?: string | null; address?: string | null; orderNumber?: string | null;
};
export const stopId = (stop: { jobId?: string; workOrderId: string }) => stop.jobId ?? stop.workOrderId;
export const navigationJobId = (id: string) => 'navigation-point:' + id;
export type PlanningJob = PlanningSource & {
  id: string; organizationId: string; title: string; workType: string; priority: string;
  status: string; scheduledAt: string; deadlineAt?: string | null; campaignDateFrom?: string | null;
  location: Coordinates | null; serviceMinutes: number | null; constraints: JobConstraints;
  blockedReason?: string; updatedAt: string;
};
export type PlanningEmployee = {
  id: string; organizationId: string; name: string; userId: string | null; isActive: boolean;
  positions: string[]; roles: string[]; available: boolean;
};
export type PlanningVehicle = { id: string; organizationId: string; name: string; status: string; reserved: boolean };
export type CrewInput = { id: string; employeeIds: string[]; vehicleId: string | null; startLocation?: Coordinates };
export type PlanningInput = {
  organizationId: string; date: string; now: string; profile: PlanningProfile;
  jobs: PlanningJob[]; employees: PlanningEmployee[]; vehicles: PlanningVehicle[]; crews: CrewInput[];
};
export type TravelLeg = { distanceMeters: number; durationSeconds: number; estimated: boolean; polyline: string };
export type PlannedStop = PlanningSource & {
  jobId?: string;
  workOrderId: string; title: string; workType: string; location: Coordinates; routeOrder: number;
  arrivalAt: string; startAt: string; endAt: string; serviceMinutes: number; travel: TravelLeg; reason: string;
};
export type PlannedCrew = CrewInput & {
  names: string[]; vehicleName: string | null; departureAt: string; endAt: string;
  stops: PlannedStop[]; returnLeg: TravelLeg; distanceMeters: number; travelSeconds: number;
  serviceMinutes: number; breakMinutes: number;
};
export type PlanningAlert = { code: string; message: string; workOrderId?: string; crewId?: string };
export type PlanningResult = {
  crews: PlannedCrew[]; unassigned: PlanningAlert[]; conflicts: PlanningAlert[]; estimated: boolean;
  explanation: string; distanceMeters: number; travelSeconds: number; serviceMinutes: number;
};
export type PlanView = {
  id: string; date: string; version: number; status: string; parentPlanId: string | null;
  approvedAt: string | null; result: PlanningResult; profile: PlanningProfile;
};
