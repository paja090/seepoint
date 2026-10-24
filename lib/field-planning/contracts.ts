export type Coordinates = { latitude: number; longitude: number };
export type CustomPlanningActivity = { key: string; label: string; defaultMinutes: number; category?: string };
export type PlanningProfile = {
  navigationPointMinutes?: Record<string, number>;
  timezone: string; country: string | null; depot: Coordinates; endLocation: Coordinates;
  workdayStart: string; workdayEnd: string; breakMinutes: number; overtimeMinutes: number;
  flexibleHours?: boolean; maxShiftHours?: number;
  strategy: 'BALANCED' | 'DISTANCE'; serviceMinutes: Record<string, number>;
  customActivities?: CustomPlanningActivity[];
  fallbackSpeedKph: number; fallbackDistanceFactor: number; maximumJobsPerRoute: number;
  vehicleRequired: boolean; requireHumanApproval: true; enabled: boolean;
  vehicleCapacitySlots?: number; warehouseUnloadMinutes?: number;
  routeMode?: 'SEPARATE_MEDIA' | 'MIXED';
};
export type JobConstraints = {
  windowStart?: string; windowEnd?: string; requiredEmployeeIds?: string[];
  requiredPositions?: string[]; predecessorIds?: string[]; vehicleRequired?: boolean;
  requiredWorkers?: number; requiredEquipment?: string[];
};
/** Optional for compatibility with persisted V1 WorkOrder snapshots. */
export type PlanningSource = {
  sourceType?: 'WORK_ORDER' | 'WORK_ORDER_ITEM' | 'NAVIGATION_POINT' | 'ELECTION_REMOVAL_POINT'; sourceId?: string;
  workOrderItemId?: string; carrierId?: string | null; surfaceId?: string | null; crmRealizationId?: string | null;
  parentWorkOrderId?: string; navigationOrderId?: string; navigationPointId?: string;
  electionCampaignId?: string; electionRemovalPointId?: string; mediaType?: string; quantity?: number;
  operationType?: string; loadSlots?: number;
  fieldWorkStepId?: string;
  clientName?: string | null; address?: string | null; orderNumber?: string | null;
};
export const stopId = (stop: { jobId?: string; workOrderId: string }) => stop.jobId ?? stop.workOrderId;
export const navigationJobId = (id: string) => 'navigation-point:' + id;
export const electionRemovalJobId = (id: string) => 'election-point:' + id;
export type PlanningJob = PlanningSource & {
  id: string; organizationId: string; title: string; workType: string; priority: string;
  status: string; scheduledAt: string; deadlineAt?: string | null; campaignDateFrom?: string | null;
  location: Coordinates | null; serviceMinutes: number | null; constraints: JobConstraints;
  blockedReason?: string; updatedAt: string;
  delivery?: { id: string; title: string; location: Coordinates; serviceMinutes: number };
};
export type PlanningEmployee = {
  id: string; organizationId: string; name: string; userId: string | null; isActive: boolean;
  positions: string[]; roles: string[]; available: boolean;
};
export type PlanningVehicle = { id: string; organizationId: string; name: string; status: string; reserved: boolean; capacitySlots?: number | null; equipment?: string[] };
export type CrewInput = { id: string; name?: string | null; employeeIds: string[]; vehicleId: string | null; startLocation?: Coordinates };
export type PlanningInput = {
  organizationId: string; date: string; now: string; profile: PlanningProfile;
  jobs: PlanningJob[]; employees: PlanningEmployee[]; vehicles: PlanningVehicle[]; crews: CrewInput[];
};
export type TravelLeg = { distanceMeters: number; durationSeconds: number; estimated: boolean; polyline: string };
export type PlannedStop = PlanningSource & {
  jobId?: string;
  workOrderId: string; title: string; workType: string; location: Coordinates; routeOrder: number;
  arrivalAt: string; startAt: string; endAt: string; serviceMinutes: number; travel: TravelLeg; reason: string;
  isWarehousePitstop?: boolean; cumulativeLoadSlots?: number; unloadedSlots?: number;
};
export type LiveCrewLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  updatedAt: string;
  isRecent: boolean;
  workerName?: string | null;
};
export type PlannedCrew = CrewInput & {
  name?: string | null;
  names: string[]; vehicleName: string | null; departureAt: string; endAt: string;
  stops: PlannedStop[]; returnLeg: TravelLeg; distanceMeters: number; travelSeconds: number;
  serviceMinutes: number; breakMinutes: number;
  liveLocation?: LiveCrewLocation | null;
};
export type PlanningAlert = { code: string; message: string; workOrderId?: string; crewId?: string };
export type PlanningResult = {
  planName?: string | null;
  crews: PlannedCrew[]; unassigned: PlanningAlert[]; conflicts: PlanningAlert[]; estimated: boolean;
  explanation: string; distanceMeters: number; travelSeconds: number; serviceMinutes: number;
};

export const fieldProblemTypes = [
  'Technický problém',
  'Nedostupný nosič',
  'Nosič zarostlý / nepřístupný',
  'Nemožnost instalace',
  'Nemožnost instalace (počasí / překážka)',
  'Poškození',
  'Poškození konstrukce',
  'Chybějící materiál',
  'Chybějící materiál nebo klíč',
  'Jiné'
] as const;

export type PlanView = {
  id: string; date: string; version: number; status: string; parentPlanId: string | null;
  approvedAt: string | null; result: PlanningResult; profile: PlanningProfile;
  name?: string | null;
};

export type MyRouteCarrier = {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
  address?: string | null;
  photoUrl?: string | null;
} | null;

export type MyRouteStopPhoto = {
  id: string;
  url: string;
  type?: string | null;
  createdAt: string;
};

export type MyRouteStop = {
  fieldWorkStepId?: string;
  quantity?: number;
  completedQuantity?: number;
  referenceUrl?: string | null;
  photoType?: string | null;
  fieldWorkStepKind?: string;
  jobId: string;
  workOrderItemId: string | null;
  navigationPointId: string | null;
  electionRemovalPointId: string | null;
  address: string | null;
  pointPhotoUrl: string | null;
  photos?: MyRouteStopPhoto[];
  workOrderId: string;
  orderTitle?: string | null;
  campaignName?: string | null;
  title: string;
  clientName: string | null;
  layerName?: string | null;
  instructions: string | null;
  status: string;
  issueType: string | null;
  issueNote: string | null;
  workType: string;
  startAt: string;
  endAt: string;
  location: Coordinates | null;
  taskId: string | null;
  navigationOrderId: string | null;
  carrier: MyRouteCarrier;
  serviceMinutes?: number;
  travelMinutes?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  actualDurationMinutes?: number | null;
  isInstantCompletion?: boolean;
  liveEstimatedStartAt?: string;
  liveEstimatedEndAt?: string;
  delayMinutes?: number;
};


export type MyRouteDTO = {
  timezone: string;
  date?: string;
  routes: Array<{
    planId: string;
    crewId?: string;
    crewName?: string | null;
    vehicleName: string | null;
    departureAt: string;
    endAt: string;
    travelMinutes?: number;
    serviceMinutes?: number;
    distanceKm?: number;
    tripStartedAt?: string | null;
    tripCompletedAt?: string | null;
    actualTripMinutes?: number | null;
    liveEstimatedEndAt?: string;
    totalDelayMinutes?: number;
    liveLocation?: LiveCrewLocation | null;
    stops: MyRouteStop[];
  }>;
};
