export function nextRouteStop<T extends {status:string}>(stops:T[]):T|undefined {
  // Continue started work first, then follow the original route order. Problems remain accessible.
  return stops.find(s=>s.status==='IN_PROGRESS')
    ?? stops.find(s=>!['DONE','CANCELLED','ISSUE'].includes(s.status))
    ?? stops.find(s=>s.status==='ISSUE');
}
