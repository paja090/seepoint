export function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

export function scoreStandardSurface(input: { cityMatch: boolean; mediaMatch: boolean; price: number | null; budgetPerItem: number | null; hasGps: boolean }) {
  const reasons = ['Plocha je v požadovaném období dostupná.'];
  let score = 40;
  if (input.cityMatch) { score += 20; reasons.push('Odpovídá požadovanému městu.'); }
  if (input.mediaMatch) { score += 15; reasons.push('Odpovídá požadovanému typu média.'); }
  if (input.price !== null && (input.budgetPerItem === null || input.price <= input.budgetPerItem)) { score += 10; reasons.push('Cena odpovídá rozpočtovému rámci.'); }
  if (input.hasGps) { score += 10; reasons.push('Má ověřitelnou polohu pro mapu a pokrytí.'); }
  return { score, reasons };
}

export function bearingSector(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const angle = Math.atan2(to.longitude - from.longitude, to.latitude - from.latitude) * 180 / Math.PI;
  return Math.floor(((angle + 360) % 360) / 90);
}
