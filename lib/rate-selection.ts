export type SelectableRate = {
  workType: string | null;
  carrierType?: string | null;
  validFrom: Date;
  validTo: Date | null;
};

export function selectRateAtDate<T extends SelectableRate>(
  rates: T[],
  workType: string | null,
  carrierTypeOrDate: string | Date | null,
  dateOrUndefined?: Date
): T | null {
  let carrierType: string | null = null;
  let date: Date;

  if (dateOrUndefined instanceof Date) {
    carrierType = carrierTypeOrDate as string | null;
    date = dateOrUndefined;
  } else if (carrierTypeOrDate instanceof Date) {
    date = carrierTypeOrDate;
  } else {
    throw new Error('Neplatné parametry pro selectRateAtDate: chybí datum.');
  }

  const valid = rates.filter(rate => rate.validFrom <= date && (!rate.validTo || rate.validTo >= date));
  const newest = (items: T[]) => [...items].sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0] ?? null;

  // Level 1: Specific workType and specific carrierType
  if (workType && carrierType) {
    const match = newest(valid.filter(r => r.workType === workType && r.carrierType === carrierType));
    if (match) return match;
  }

  // Level 2: Specific workType and no carrierType
  if (workType) {
    const match = newest(valid.filter(r => r.workType === workType && !r.carrierType));
    if (match) return match;
  }

  // Level 3: No workType and specific carrierType
  if (carrierType) {
    const match = newest(valid.filter(r => !r.workType && r.carrierType === carrierType));
    if (match) return match;
  }

  // Level 4: No workType and no carrierType (general)
  return newest(valid.filter(r => !r.workType && !r.carrierType));
}

export function endDateBefore(validFrom: Date) {
  const result = new Date(validFrom);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

export function canManageWorkerFinancials(role: string) { return role === 'ADMIN'; }
