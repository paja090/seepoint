export type AvailabilityOccupancy = { status: string; dateFrom: Date; dateTo: Date };

export function hasBlockingCollision(
  occupancies: AvailabilityOccupancy[],
  dateFrom: Date,
  dateTo: Date,
) {
  return occupancies.some((row) =>
    ['RESERVED', 'OCCUPIED'].includes(row.status)
    && row.dateFrom <= dateTo
    && row.dateTo >= dateFrom,
  );
}

export function isSurfaceAvailable(input: {
  surfaceStatus: string;
  carrierActive: boolean;
  carrierArchived: boolean;
  occupancies: AvailabilityOccupancy[];
  dateFrom: Date;
  dateTo: Date;
}) {
  return input.carrierActive
    && !input.carrierArchived
    && !['RESERVED', 'OCCUPIED', 'OUT_OF_SERVICE'].includes(input.surfaceStatus)
    && !hasBlockingCollision(input.occupancies, input.dateFrom, input.dateTo);
}
