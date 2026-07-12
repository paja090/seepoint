export type SelectableRate = { workType: string | null; validFrom: Date; validTo: Date | null };

export function selectRateAtDate<T extends SelectableRate>(rates: T[], workType: string | null, date: Date) {
  const valid = rates.filter(rate => rate.validFrom <= date && (!rate.validTo || rate.validTo >= date));
  const newest = (items: T[]) => [...items].sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0] ?? null;
  return workType
    ? newest(valid.filter(rate => rate.workType === workType)) ?? newest(valid.filter(rate => rate.workType === null))
    : newest(valid.filter(rate => rate.workType === null));
}

export function endDateBefore(validFrom: Date) {
  const result = new Date(validFrom);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

export function canManageWorkerFinancials(role: string) { return role === 'ADMIN'; }
