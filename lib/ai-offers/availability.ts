import { periodsOverlap, BLOCKING_OCCUPANCY_STATUSES } from '../occupancy/availability-service';

export type AvailabilityOccupancy = { status: string; dateFrom: Date; dateTo: Date };

export function hasBlockingCollision(
  occupancies: AvailabilityOccupancy[],
  dateFrom: Date,
  dateTo: Date,
) {
  return occupancies.some((row) =>
    BLOCKING_OCCUPANCY_STATUSES.includes(row.status as (typeof BLOCKING_OCCUPANCY_STATUSES)[number])
    && periodsOverlap(row.dateFrom, row.dateTo, dateFrom, dateTo),
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

