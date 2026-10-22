import { stopId, type PlanningInput, type PlanningResult } from './contracts';

export function hasApprovableWork(result: PlanningResult): boolean {
  return result.conflicts.length === 0 && result.crews.some(crew => crew.stops.some(stop => !stop.isWarehousePitstop));
}

export function validateApprovalSelection(input: PlanningInput, result: PlanningResult) {
  if (!hasApprovableWork(result)) throw new Error('Návrh musí obsahovat naplánovanou práci bez konfliktů posádek a vozidel.');
  const stops = result.crews.flatMap(crew => crew.stops.filter(stop => !stop.isWarehousePitstop));
  const accepted = new Map(stops.map(stop => [stopId(stop), stop]));
  if (accepted.size !== stops.length) throw new Error('Stejná práce je naplánována vícekrát. Přepočítejte návrh.');
  for (const stop of stops) {
    const job = input.jobs.find(job => job.id === stopId(stop));
    if (!job || job.blockedReason) throw new Error('Naplánovaná práce již není dostupná. Přepočítejte návrh.');
    for (const predecessorId of job.constraints.predecessorIds ?? []) {
      if (input.jobs.some(job => job.id === predecessorId && job.status === 'DONE')) continue;
      const predecessor = accepted.get(predecessorId);
      if (!predecessor || !(Date.parse(predecessor.endAt) <= Date.parse(stop.startAt))) {
        throw new Error('Naplánované práci chybí dokončený předchozí krok. Přepočítejte návrh.');
      }
    }
  }
}
