import type { Coordinates, PlanningInput, PlanningResult, PlannedCrew, PlanningJob, TravelLeg } from './contracts';
import { coordinates, parseProfile, zonedTime } from './profile';

export type TravelProvider = (from: Coordinates, to: Coordinates) => Promise<TravelLeg>;
const rank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const iso = (ms: number) => new Date(ms).toISOString();
export function distanceMeters(a: Coordinates, b: Coordinates) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function estimatedLeg(from: Coordinates, to: Coordinates, profile: PlanningInput['profile']): TravelLeg {
  const meters = Math.ceil(distanceMeters(from, to) * profile.fallbackDistanceFactor);
  return { distanceMeters: meters, durationSeconds: Math.ceil(meters / (profile.fallbackSpeedKph / 3.6)), estimated: true, polyline: '' };
}
const emptyLeg = (): TravelLeg => ({ distanceMeters: 0, durationSeconds: 0, estimated: false, polyline: '' });
function deadline(job: PlanningJob) {
  return Math.min(...[job.deadlineAt, job.constraints.windowEnd,
    ['INSTALLATION', 'REINSTALLATION', 'NAVIGATION_INSTALLATION'].includes(job.workType) ? job.campaignDateFrom : null]
    .filter((v): v is string => Boolean(v)).map(Date.parse), Infinity);
}
/** Replaceable deterministic heuristic. Every candidate is checked using the supplied road provider. */
export async function planFieldWork(input: PlanningInput, travel: TravelProvider): Promise<PlanningResult> {
  const p = parseProfile(input.profile);
  const all = [...input.jobs, ...input.employees, ...input.vehicles];
  if (all.some(row => row.organizationId !== input.organizationId)) throw new Error('Cross-tenant reference rejected.');
  for (const rows of [input.jobs, input.employees, input.vehicles]) if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Duplicitní vstupní ID.');
  const start = Math.max(zonedTime(input.date, p.workdayStart, p.timezone), Date.parse(input.now));
  const end = zonedTime(input.date, p.workdayEnd, p.timezone) + p.overtimeMinutes * 60000;
  if (!Number.isFinite(start)) throw new Error('Neplatný čas plánování.');
  const result: PlanningResult = { crews: [], unassigned: [], conflicts: [], estimated: false, explanation: '', distanceMeters: 0, travelSeconds: 0, serviceMinutes: 0 };
  const usedEmployees = new Set<string>(); const usedVehicles = new Set<string>(); const crewIds = new Set<string>();
  for (const crew of input.crews) {
    if (crewIds.has(crew.id)) throw new Error('Duplicitní posádka.');
    crewIds.add(crew.id);
    const members = crew.employeeIds.map(id => input.employees.find(e => e.id === id));
    if (!members.length || members.some(e => !e)) throw new Error('Neplatný pracovník posádky.');
    const vehicle = crew.vehicleId ? input.vehicles.find(v => v.id === crew.vehicleId) : null;
    if (crew.vehicleId && !vehicle) throw new Error('Neplatné vozidlo posádky.');
    if (crew.startLocation && !coordinates(crew.startLocation)) throw new Error('Neplatný výchozí bod posádky.');
    if (members.some(e => !e!.isActive || !e!.available || usedEmployees.has(e!.id)) || new Set(crew.employeeIds).size !== crew.employeeIds.length) {
      result.conflicts.push({ code: 'WORKER_UNAVAILABLE', crewId: crew.id, message: `Posádka ${crew.id}: nepřítomný, neaktivní nebo opakovaně použitý pracovník.` }); continue;
    }
    if (vehicle && (['SERVICE', 'OUT_OF_SERVICE', 'IN_USE'].includes(vehicle.status) || vehicle.reserved || usedVehicles.has(vehicle.id))) {
      result.conflicts.push({ code: 'VEHICLE_CONFLICT', crewId: crew.id, message: `Vozidlo ${vehicle.name} není dostupné.` }); continue;
    }
    members.forEach(e => usedEmployees.add(e!.id)); if (vehicle) usedVehicles.add(vehicle.id);
    result.crews.push({ ...crew, names: members.map(e => e!.name), vehicleName: vehicle?.name ?? null,
      departureAt: iso(start), endAt: iso(start), stops: [], returnLeg: emptyLeg(), distanceMeters: 0, travelSeconds: 0, serviceMinutes: 0, breakMinutes: p.breakMinutes });
  }
  const pending = input.jobs.filter(j => !['DONE', 'CANCELLED'].includes(j.status));
  const done = new Map(input.jobs.filter(j => j.status === 'DONE').map(j => [j.id, start]));
  const cache = new Map<string, Promise<TravelLeg>>();
  const leg = (a: Coordinates, b: Coordinates) => {
    const key = JSON.stringify([a, b]);
    if (!cache.has(key)) cache.set(key, travel(a, b).then(value => {
      if (![value.distanceMeters, value.durationSeconds].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Neplatný výsledek trasování.');
      return value;
    }));
    return cache.get(key)!;
  };
  while (pending.length) {
    const ready = pending.filter(j => (j.constraints.predecessorIds ?? []).every(id => done.has(id)));
    if (!ready.length) {
      result.unassigned.push(...pending.map(j => ({ code: 'DEPENDENCY_BLOCKED', workOrderId: j.id, message: `${j.title}: nesplněné nebo cyklické povinné pořadí.` }))); break;
    }
    const near = (job: PlanningJob) => coordinates(job.location) ? Math.min(...result.crews.map(c => distanceMeters(c.stops.at(-1)?.location ?? c.startLocation ?? p.depot, job.location!)), Infinity) : Infinity;
    ready.sort((a, b) => deadline(a) - deadline(b) || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2) || near(a) - near(b) || Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.id.localeCompare(b.id));
    const job = ready[0]; pending.splice(pending.indexOf(job), 1);
    const service = job.serviceMinutes ?? p.serviceMinutes[job.workType];
    let reason = job.blockedReason || (!coordinates(job.location) ? 'Chybí jednoznačná GPS lokalizace.' : !Number.isFinite(service) || service <= 0 ? 'Chybí nakonfigurovaná délka práce.' : 'Práce se nevejde do dostupnosti, časového okna nebo požadavků posádky.');
    let best: { crew: PlannedCrew; incoming: TravelLeg; returning: TravelLeg; arrival: number; begin: number; finish: number; returnAt: number; score: number } | null = null;
    if (!job.blockedReason && coordinates(job.location) && Number.isFinite(service) && service > 0) for (const crew of result.crews) {
      if (job.sourceType === 'NAVIGATION_POINT' && !input.employees.find(e => e.id === crew.employeeIds[0])?.userId) continue;
      if (crew.stops.length >= p.maximumJobsPerRoute) continue;
      if ((job.constraints.vehicleRequired ?? p.vehicleRequired) && !crew.vehicleId) continue;
      if ((job.constraints.requiredEmployeeIds ?? []).some(id => !crew.employeeIds.includes(id))) continue;
      const positions = crew.employeeIds.flatMap(id => input.employees.find(e => e.id === id)!.positions);
      if ((job.constraints.requiredPositions ?? []).some(position => !positions.includes(position))) continue;
      const previous = crew.stops.at(-1);
      const incoming = await leg(previous?.location ?? crew.startLocation ?? p.depot, job.location);
      const returning = await leg(job.location, p.endLocation);
      const arrival = (previous ? Date.parse(previous.endAt) : start) + incoming.durationSeconds * 1000;
      const begin = Math.max(arrival, job.constraints.windowStart ? Date.parse(job.constraints.windowStart) : start,
        ...((job.constraints.predecessorIds ?? []).map(id => done.get(id)!)));
      const finish = begin + service * 60000;
      // Reserve a contiguous break after service, before return; it is included in end-of-shift feasibility.
      const returnAt = finish + p.breakMinutes * 60000 + returning.durationSeconds * 1000;
      if (finish > deadline(job) || returnAt > end) continue;
      const score = p.strategy === 'BALANCED' ? finish + incoming.durationSeconds * 250 : incoming.distanceMeters + returning.distanceMeters - crew.returnLeg.distanceMeters;
      if (!best || score < best.score) best = { crew, incoming, returning, arrival, begin, finish, returnAt, score };
    }
    if (!best) {
      if (deadline(job) < start) reason = 'Pevný termín už vypršel.';
      result.unassigned.push({ code: deadline(job) < Infinity ? 'DEADLINE_AT_RISK' : 'WORK_ORDER_UNASSIGNED', workOrderId: job.id, message: `${job.title}: ${reason}` }); continue;
    }
    const { crew, incoming, returning, arrival, begin, finish, returnAt } = best;
    crew.stops.push({ jobId: job.id, workOrderId: job.parentWorkOrderId ?? (job.sourceType === 'NAVIGATION_POINT' ? '' : job.id),
      sourceType: job.sourceType, sourceId: job.sourceId, parentWorkOrderId: job.parentWorkOrderId,
      workOrderItemId: job.workOrderItemId, carrierId: job.carrierId, surfaceId: job.surfaceId, crmRealizationId: job.crmRealizationId,
      navigationPointId: job.navigationPointId, navigationOrderId: job.navigationOrderId,
      clientName: job.clientName, address: job.address, orderNumber: job.orderNumber, title: job.title, workType: job.workType, location: job.location!, routeOrder: crew.stops.length + 1,
      arrivalAt: iso(arrival), startAt: iso(begin), endAt: iso(finish), serviceMinutes: service, travel: incoming,
      reason: `Priorita ${job.priority}; ověřená dostupnost, kvalifikace a časové limity. ${incoming.estimated ? 'Přejezd je odhad.' : 'Přejezd podle Google Routes.'}` });
    crew.returnLeg = returning; crew.endAt = iso(returnAt); done.set(job.id, finish);
  }
  result.crews = result.crews.filter(c => c.stops.length);
  for (const c of result.crews) {
    c.distanceMeters = c.stops.reduce((n, s) => n + s.travel.distanceMeters, c.returnLeg.distanceMeters);
    c.travelSeconds = c.stops.reduce((n, s) => n + s.travel.durationSeconds, c.returnLeg.durationSeconds);
    c.serviceMinutes = c.stops.reduce((n, s) => n + s.serviceMinutes, 0);
    result.distanceMeters += c.distanceMeters; result.travelSeconds += c.travelSeconds; result.serviceMinutes += c.serviceMinutes;
    result.estimated ||= c.returnLeg.estimated || c.stops.some(s => s.travel.estimated);
  }
  result.explanation = `Práce je rozdělena do ${result.crews.length} posádek. Pořadí upřednostňuje prioritu a pevné termíny v mezích dostupnosti. ${result.unassigned.length} úkolů zůstává nepřiřazeno. ${result.estimated ? 'Některé přejezdy jsou odhadnuty z GPS a nastavení organizace; před schválením je ověřte.' : 'Doby přejezdů vycházejí ze silničních tras.'}`;
  return result;
}
