import { OccupancyStatus, SurfaceStatus } from '@prisma/client';
import { getSurfaceAvailabilityState, type BasicOccupancyRecord } from './occupancy/availability-service';

export type SurfaceOccupancyState = {
  status: SurfaceStatus;
  currentClientId: string | null;
  currentRentStart: Date | null;
  currentRentEnd: Date | null;
  activeOccupancyId: string | null;
};

export type BasicOccupancy = BasicOccupancyRecord;

/**
 * Derives the real-time surface occupancy status and client details
 * based on active Occupancy records for a given reference date (defaults to now).
 * Delegated to canonical availability-service.ts to maintain a single source of truth.
 */
export function deriveSurfaceOccupancyState(
  occupancies: BasicOccupancy[],
  referenceDate: Date = new Date()
): SurfaceOccupancyState {
  return getSurfaceAvailabilityState(occupancies, referenceDate);
}

