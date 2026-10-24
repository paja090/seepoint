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
    const job = input.jobs.find(job => job.id === stopId(stop) || (job.delivery && 'field-step:' + job.delivery.id === stopId(stop)));
    if (job?.delivery && (!accepted.has(job.id) || !accepted.has('field-step:' + job.delivery.id))) {
      throw new Error('Přesun musí obsahovat vyzvednutí i doručení materiálu. Přepočítejte návrh.');
    }
    if(job?.delivery){
      const pickupCrew=result.crews.find(c=>c.stops.some(s=>stopId(s)===job.id));
      const deliveryCrew=result.crews.find(c=>c.stops.some(s=>stopId(s)==='field-step:'+job.delivery!.id));
      if(pickupCrew?.id!==deliveryCrew?.id || Date.parse(accepted.get(job.id)!.endAt)>Date.parse(accepted.get('field-step:'+job.delivery.id)!.startAt))throw new Error('Vyzvednutí a předání musí navazovat ve stejné posádce.');
    }
    if (!job || job.blockedReason) throw new Error('Naplánovaná práce již není dostupná. Přepočítejte návrh.');
    for (const predecessorId of job.constraints.predecessorIds ?? []) {
      if (input.jobs.some(job => job.id === predecessorId && job.status === 'DONE')) continue;
      const predecessorJob = input.jobs.find(job => job.id === predecessorId);
      const predecessor = accepted.get(predecessorJob?.delivery ? 'field-step:' + predecessorJob.delivery.id : predecessorId);
      if (!predecessor || !(Date.parse(predecessor.endAt) <= Date.parse(stop.startAt))) {
        throw new Error('Naplánované práci chybí dokončený předchozí krok. Přepočítejte návrh.');
      }
    }
  }
}
