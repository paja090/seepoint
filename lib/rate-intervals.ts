export type RateInterval = { validFrom: Date; validTo: Date | null };
export function intervalsOverlap(a: RateInterval, b: RateInterval) {
  const forever = new Date(8640000000000000);
  return a.validFrom <= (b.validTo ?? forever) && b.validFrom <= (a.validTo ?? forever);
}
