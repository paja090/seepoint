export function vehicleDeadlines(vehicle: { technicalInspectionUntil: Date | null; insuranceUntil: Date | null; highwayPassUntil: Date | null }, now = new Date()) {
  const limit = +now + 30 * 86400000;
  return ([['STK', vehicle.technicalInspectionUntil], ['Pojištění', vehicle.insuranceUntil], ['Dálniční známka', vehicle.highwayPassUntil]] as const)
    .filter((entry): entry is readonly [typeof entry[0], Date] => entry[1] !== null && +entry[1] <= limit)
    .map(([label, date]) => ({ label, date, overdue: date.toISOString().slice(0, 10) < now.toISOString().slice(0, 10) }));
}
