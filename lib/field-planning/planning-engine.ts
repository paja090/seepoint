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
  const maxOvertime = p.flexibleHours ? Math.max(p.overtimeMinutes, 480) : p.overtimeMinutes;
  const end = zonedTime(input.date, p.workdayEnd, p.timezone) + maxOvertime * 60000;
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
    result.crews.push({ ...crew, name: crew.name?.trim() || null, names: members.map(e => e!.name), vehicleName: vehicle?.name ?? null,
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
  const crewLoadSlots = new Map<string, number>();
  const crewLoadMediaType = new Map<string, string | null>();
  while (pending.length) {
    const ready = pending.filter(j => (j.constraints.predecessorIds ?? []).every(id => done.has(id)));
    if (!ready.length) {
      result.unassigned.push(...pending.map(j => ({ code: 'DEPENDENCY_BLOCKED', workOrderId: j.id, message: `${j.title}: nesplněné nebo cyklické povinné pořadí.` }))); break;
    }
    const near = (job: PlanningJob) => coordinates(job.location) ? Math.min(...result.crews.map(c => distanceMeters(c.stops.at(-1)?.location ?? c.startLocation ?? p.depot, job.location!)), Infinity) : Infinity;
    ready.sort((a, b) => deadline(a) - deadline(b) || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2) || near(a) - near(b) || Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.id.localeCompare(b.id));
    const job = ready[0]; pending.splice(pending.indexOf(job), 1);
    const service = job.serviceMinutes ?? p.serviceMinutes[job.workType];
    const jobLoad = job.loadSlots ?? 0;
    const maxCap = p.vehicleCapacitySlots;
    const unloadMins = p.warehouseUnloadMinutes ?? 15;
    let reason = job.blockedReason || (!coordinates(job.location) ? 'Chybí jednoznačná GPS lokalizace.' : !Number.isFinite(service) || service <= 0 ? 'Chybí nakonfigurovaná délka práce.' : 'Práce se nevejde do dostupnosti, časového okna nebo požadavků posádky.');
    let best: { crew: PlannedCrew; incoming: TravelLeg; returning: TravelLeg; arrival: number; begin: number; finish: number; returnAt: number; score: number;
      delivery?: { incoming: TravelLeg; arrival: number; finish: number };
      pitstop?: { incoming: TravelLeg; arrival: number; finish: number; unloadedSlots: number; unloadedMedium: string | null; isMediaConflict: boolean } } | null = null;
    if (!job.blockedReason && coordinates(job.location) && Number.isFinite(service) && service > 0) for (const crew of result.crews) {
      const vehicle = input.vehicles.find(v => v.id === crew.vehicleId);
      const capacity = vehicle?.capacitySlots ?? maxCap;
      if (job.fieldWorkStepId && jobLoad > 0 && !vehicle?.capacitySlots) { reason = 'U konkrétního vozidla není ověřená kapacita. Doplňte ji před plánováním.'; continue; }
      if (p.routeMode === 'SEPARATE_MEDIA' && job.mediaType && crew.stops.some(s => s.mediaType && s.mediaType !== job.mediaType)) { reason = 'Oddělená trasa již obsahuje jiné médium. Přidejte posádku nebo zapněte společné trasy.'; continue; }
      if (jobLoad > 0 && (!crew.vehicleId || !capacity || jobLoad > capacity)) {
        reason = `Úkol vyžaduje ${jobLoad} slotů; vozidlo má ${capacity ?? 0}. Vyberte větší vozidlo nebo explicitně rozdělte množství na samostatné práce.`;
        continue;
      }
      if (crew.employeeIds.length < (job.constraints.requiredWorkers ?? 1)) continue;
      if ((job.constraints.requiredEquipment ?? []).some(e => !vehicle?.equipment?.includes(e))) continue;
      if (job.sourceType === 'NAVIGATION_POINT' && !input.employees.find(e => e.id === crew.employeeIds[0])?.userId) continue;
      if (crew.stops.length >= p.maximumJobsPerRoute) continue;
      if ((job.constraints.vehicleRequired ?? p.vehicleRequired) && !crew.vehicleId) continue;
      if ((job.constraints.requiredEmployeeIds ?? []).some(id => !crew.employeeIds.includes(id))) continue;
      const positions = crew.employeeIds.flatMap(id => input.employees.find(e => e.id === id)!.positions);
      if ((job.constraints.requiredPositions ?? []).some(position => !positions.includes(position))) continue;
      const previous = crew.stops.at(-1);
      const currentLoad = crewLoadSlots.get(crew.id) ?? 0;
      const currentMedium = crewLoadMediaType.get(crew.id) ?? null;
      const jobMedium = job.mediaType ?? null;

      // Medium conflict: crew currently has cargo of a DIFFERENT physical medium on vehicle
      // (Banners/0-slot operations do not conflict because they don't load structural frames)
      const hasMediaConflict = Boolean(
        p.routeMode !== 'MIXED' && capacity &&
        jobLoad > 0 &&
        currentLoad > 0 &&
        currentMedium &&
        jobMedium &&
        currentMedium !== jobMedium
      );

      const isCapacityExceeded = Boolean(
        capacity &&
        currentLoad > 0 &&
        jobLoad > 0 &&
        currentLoad + jobLoad > capacity
      );

      let pitstop: { incoming: TravelLeg; arrival: number; finish: number; unloadedSlots: number; unloadedMedium: string | null; isMediaConflict: boolean } | undefined;
      let incoming: TravelLeg;
      let arrival: number;

      if ((hasMediaConflict || isCapacityExceeded) && currentLoad > 0) {
        // Vehicle capacity exceeded OR changing media type: pitstop at depot required to unload
        const toDepot = await leg(previous?.location ?? crew.startLocation ?? p.depot, p.depot);
        const pitstopArrival = (previous ? Date.parse(previous.endAt) : start) + toDepot.durationSeconds * 1000;
        const pitstopFinish = pitstopArrival + unloadMins * 60000;
        pitstop = {
          incoming: toDepot,
          arrival: pitstopArrival,
          finish: pitstopFinish,
          unloadedSlots: currentLoad,
          unloadedMedium: currentMedium,
          isMediaConflict: hasMediaConflict,
        };
        incoming = await leg(p.depot, job.location);
        arrival = pitstopFinish + incoming.durationSeconds * 1000;
      } else {
        incoming = await leg(previous?.location ?? crew.startLocation ?? p.depot, job.location);
        arrival = (previous ? Date.parse(previous.endAt) : start) + incoming.durationSeconds * 1000;
      }

      const begin = Math.max(arrival, job.constraints.windowStart ? Date.parse(job.constraints.windowStart) : start,
        ...((job.constraints.predecessorIds ?? []).map(id => done.get(id)!)));
      const finish = begin + service * 60000;
      let delivery: { incoming: TravelLeg; arrival: number; finish: number } | undefined;
      if (job.delivery) {
        if (!coordinates(job.delivery.location) || !Number.isFinite(job.delivery.serviceMinutes) || job.delivery.serviceMinutes <= 0) continue;
        const incomingDelivery = await leg(job.location, job.delivery.location);
        const arrivalDelivery = finish + incomingDelivery.durationSeconds * 1000;
        delivery = { incoming: incomingDelivery, arrival: arrivalDelivery, finish: arrivalDelivery + job.delivery.serviceMinutes * 60000 };
      }
      const lastLocation = job.delivery?.location ?? job.location;
      const remainingLoad = (pitstop ? 0 : currentLoad) + (job.delivery ? 0 : jobLoad);
      // Include the actual last unloading, break and return before accepting a candidate.
      const toDepot = remainingLoad > 0 ? await leg(lastLocation, p.depot) : null;
      const returning = await leg(toDepot ? p.depot : lastLocation, p.endLocation);
      // Reserve a contiguous break after service, before return; it is included in end-of-shift feasibility.
      const returnAt = (delivery?.finish ?? finish) + p.breakMinutes * 60000 + returning.durationSeconds * 1000 + (toDepot ? toDepot.durationSeconds * 1000 + unloadMins * 60000 : 0);
      if ((delivery?.finish ?? finish) > deadline(job) || returnAt > end || (p.maxShiftHours && returnAt - start > p.maxShiftHours * 3600000)) continue;

      // Co-located items (same physical GPS / location within 25m in election removal):
      // Must stay together on the same crew! Prioritize crew already on site.
      const isCoLocated = Boolean(
        job.workType === 'ELECTION_REMOVAL' &&
        previous &&
        coordinates(job.location) &&
        distanceMeters(previous.location, job.location) <= 25
      );
      // Prefer crews that are already carrying the SAME medium or empty, penalize medium switching
      const sameMediumBonus = currentMedium && jobMedium && currentMedium === jobMedium ? -50_000 : 0;
      const mediumConflictPenalty = hasMediaConflict ? 50_000 : 0;

      const score = isCoLocated
        ? -1_000_000_000 + finish
        : (p.strategy === 'BALANCED'
        ? finish + incoming.durationSeconds * 250
        : incoming.distanceMeters + returning.distanceMeters - crew.returnLeg.distanceMeters) + sameMediumBonus + mediumConflictPenalty;

      if (!best || score < best.score) best = { crew, incoming, returning, arrival, begin, finish, returnAt, score, pitstop, delivery };
    }
    if (!best) {
      if (deadline(job) < start) reason = 'Pevný termín už vypršel.';
      result.unassigned.push({ code: deadline(job) < Infinity ? 'DEADLINE_AT_RISK' : 'WORK_ORDER_UNASSIGNED', workOrderId: job.id, message: `${job.title}: ${reason}` }); continue;
    }
    const { crew, incoming, returning, arrival, begin, finish, returnAt, pitstop, delivery } = best;
    if (pitstop) {
      const mediaLabel = pitstop.unloadedMedium ? pitstop.unloadedMedium : 'materiálu';
      const reason = pitstop.isMediaConflict
        ? `Změna média: Na vozidle je ${pitstop.unloadedSlots} ks (${mediaLabel}), odváží se samostatně. Vykládka na skladě.`
        : `Kapacita vozidla naplněna (${pitstop.unloadedSlots}/${maxCap} slotů). Vykládka na skladě.`;

      crew.stops.push({
        jobId: `depot-pitstop-${crew.id}-${crew.stops.length + 1}`,
        workOrderId: '',
        sourceType: 'ELECTION_REMOVAL_POINT',
        title: `Centrální sklad: Vykládka materiálu (${pitstop.unloadedSlots} ks${pitstop.unloadedMedium ? ` – ${pitstop.unloadedMedium}` : ''})`,
        workType: 'WAREHOUSE_UNLOAD',
        location: p.depot,
        routeOrder: crew.stops.length + 1,
        arrivalAt: iso(pitstop.arrival),
        startAt: iso(pitstop.arrival),
        endAt: iso(pitstop.finish),
        serviceMinutes: unloadMins,
        travel: pitstop.incoming,
        reason,
        isWarehousePitstop: true,
        unloadedSlots: pitstop.unloadedSlots,
        cumulativeLoadSlots: 0,
      });
      crewLoadSlots.set(crew.id, 0);
      crewLoadMediaType.set(crew.id, null);
    }
    const isRelocation = job.operationType === 'RELOCATION';
    const isBannerChange = job.operationType === 'BANNER_CHANGE';
    const newLoad = !job.delivery && (isRelocation || isBannerChange)
      ? (crewLoadSlots.get(crew.id) ?? 0)
      : (crewLoadSlots.get(crew.id) ?? 0) + jobLoad;
    crewLoadSlots.set(crew.id, newLoad);
    if (newLoad > 0 && job.mediaType && !isRelocation && !isBannerChange) {
      crewLoadMediaType.set(crew.id, job.mediaType);
    } else if (newLoad === 0) {
      crewLoadMediaType.set(crew.id, null);
    }
    crew.stops.push({ jobId: job.id, workOrderId: job.parentWorkOrderId ?? (['NAVIGATION_POINT', 'ELECTION_REMOVAL_POINT'].includes(job.sourceType ?? '') ? '' : job.id),
      sourceType: job.sourceType, sourceId: job.sourceId, parentWorkOrderId: job.parentWorkOrderId,
      fieldWorkStepId: job.fieldWorkStepId,
      workOrderItemId: job.workOrderItemId, carrierId: job.carrierId, surfaceId: job.surfaceId, crmRealizationId: job.crmRealizationId,
      navigationPointId: job.navigationPointId, navigationOrderId: job.navigationOrderId,
      electionCampaignId: job.electionCampaignId, electionRemovalPointId: job.electionRemovalPointId,
      mediaType: job.mediaType, quantity: job.quantity, operationType: job.operationType, loadSlots: job.loadSlots,
      cumulativeLoadSlots: newLoad,
      clientName: job.clientName, address: job.address, orderNumber: job.orderNumber, title: job.title, workType: job.workType, location: job.location!, routeOrder: crew.stops.length + 1,
      arrivalAt: iso(arrival), startAt: iso(begin), endAt: iso(finish), serviceMinutes: service, travel: incoming,
      reason: `Priorita ${job.priority}; ověřená dostupnost, kvalifikace a časové limity. ${incoming.estimated ? 'Přejezd je odhad.' : 'Přejezd podle Google Routes.'}` });
    if (job.delivery && delivery) {
      const pickup = crew.stops.at(-1)!;
      crew.stops.push({ ...pickup, jobId: `field-step:${job.delivery.id}`, fieldWorkStepId: job.delivery.id,
        title: job.delivery.title, location: job.delivery.location, routeOrder: crew.stops.length + 1,
        arrivalAt: iso(delivery.arrival), startAt: iso(delivery.arrival), endAt: iso(delivery.finish),
        serviceMinutes: job.delivery.serviceMinutes, travel: delivery.incoming, loadSlots: -jobLoad,
        cumulativeLoadSlots: newLoad - jobLoad, reason: 'Navazující doručení stejnou posádkou a vozidlem.' });
      crewLoadSlots.set(crew.id, newLoad - jobLoad);
    }
    crew.returnLeg = returning; crew.endAt = iso(returnAt); done.set(job.id, delivery?.finish ?? finish);
  }

  // Závěrečný flush: Pokud posádka po posledním úkolu veze nějaký materiál a směna nekončí na centrálním skladě, musíme ji na konci dne poslat na sklad k vyložení.
  for (const crew of result.crews) {
    const finalLoad = crewLoadSlots.get(crew.id) ?? 0;
    if (finalLoad > 0 && crew.stops.length > 0) {
      const lastStop = crew.stops[crew.stops.length - 1];
      const lastLocation = lastStop.location;
      const arrivalTime = Date.parse(lastStop.endAt);
      const finalMedium = crewLoadMediaType.get(crew.id);
      const maxCap = p.vehicleCapacitySlots;
      
      const toDepot = await leg(lastLocation, p.depot);
      const pitstopArrival = arrivalTime + toDepot.durationSeconds * 1000;
      const pitstopFinish = pitstopArrival + (p.warehouseUnloadMinutes ?? 15) * 60000;
      
      const mediaLabel = finalMedium ? finalMedium : 'materiálu';
      crew.stops.push({
        jobId: `depot-pitstop-${crew.id}-final`,
        workOrderId: '',
        sourceType: 'ELECTION_REMOVAL_POINT',
        title: `Centrální sklad: Závěrečná vykládka (${finalLoad} ks${finalMedium ? ` – ${finalMedium}` : ''})`,
        workType: 'WAREHOUSE_UNLOAD',
        location: p.depot,
        routeOrder: crew.stops.length + 1,
        arrivalAt: iso(pitstopArrival),
        startAt: iso(pitstopArrival),
        endAt: iso(pitstopFinish),
        serviceMinutes: p.warehouseUnloadMinutes ?? 15,
        travel: toDepot,
        reason: `Závěrečný návrat na sklad k vyložení vozidla (${finalLoad}/${maxCap} slotů).`,
        isWarehousePitstop: true,
        unloadedSlots: finalLoad,
        cumulativeLoadSlots: 0,
      });
      
      // Přenastavit návratovou cestu ze skladu do endLocation
      crew.returnLeg = await leg(p.depot, p.endLocation);
      crew.endAt = iso(pitstopFinish + p.breakMinutes * 60000 + crew.returnLeg.durationSeconds * 1000);
      crewLoadSlots.set(crew.id, 0);
      crewLoadMediaType.set(crew.id, null);
    }
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
