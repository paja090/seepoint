export function overlapsAbsence(scheduled: Date, deadline: Date | null, absence: { dateFrom: Date; dateTo: Date }) {
  // Both absence endpoints represent complete calendar days.
  const from = scheduled.toISOString().slice(0, 10);
  const to = (deadline ?? scheduled).toISOString().slice(0, 10);
  return from <= absence.dateTo.toISOString().slice(0, 10) && to >= absence.dateFrom.toISOString().slice(0, 10);
}
