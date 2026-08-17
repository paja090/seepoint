import { OccupancyStatus, SurfaceStatus } from '@prisma/client';

export type SurfaceOccupancyState = {
  status: SurfaceStatus;
  currentClientId: string | null;
  currentRentStart: Date | null;
  currentRentEnd: Date | null;
  activeOccupancyId: string | null;
};

export type BasicOccupancy = {
  id: string;
  clientId: string | null;
  status: OccupancyStatus;
  dateFrom: Date;
  dateTo: Date;
};

/**
 * Derives the real-time surface occupancy status and client details
 * based on active Occupancy records for a given reference date (defaults to now).
 * 
 * Preference order of Occupancy status when multiple overlap:
 * 1. OUT_OF_SERVICE
 * 2. OCCUPIED
 * 3. RESERVED
 * 4. NEGOTIATION
 * 5. AVAILABLE
 */
export function deriveSurfaceOccupancyState(
  occupancies: BasicOccupancy[],
  referenceDate: Date = new Date()
): SurfaceOccupancyState {
  const refTime = referenceDate.getTime();

  // Active occupancies cover the reference date
  const activeOccupancies = occupancies.filter((occ) => {
    const fromTime = new Date(occ.dateFrom).getTime();
    const toTime = new Date(occ.dateTo).getTime();
    return (
      occ.status !== 'FINISHED' &&
      occ.status !== 'CANCELLED' &&
      fromTime <= refTime &&
      toTime >= refTime
    );
  });

  if (activeOccupancies.length === 0) {
    // Check if there is an upcoming reservation or occupied state to know rent dates if needed
    return {
      status: 'AVAILABLE',
      currentClientId: null,
      currentRentStart: null,
      currentRentEnd: null,
      activeOccupancyId: null,
    };
  }

  // Priority mapping: OUT_OF_SERVICE > OCCUPIED > RESERVED > NEGOTIATION > AVAILABLE
  const priorityMap: Record<OccupancyStatus, number> = {
    OUT_OF_SERVICE: 5,
    OCCUPIED: 4,
    RESERVED: 3,
    NEGOTIATION: 2,
    AVAILABLE: 1,
    FINISHED: 0,
    CANCELLED: 0,
  };

  const sorted = [...activeOccupancies].sort(
    (a, b) => (priorityMap[b.status] || 0) - (priorityMap[a.status] || 0)
  );

  const topMatch = sorted[0];

  const surfaceStatusMap: Partial<Record<OccupancyStatus, SurfaceStatus>> = {
    OUT_OF_SERVICE: 'OUT_OF_SERVICE',
    OCCUPIED: 'OCCUPIED',
    RESERVED: 'RESERVED',
    NEGOTIATION: 'NEGOTIATION',
    AVAILABLE: 'AVAILABLE',
  };

  const status = surfaceStatusMap[topMatch.status] ?? 'AVAILABLE';

  return {
    status,
    currentClientId: topMatch.clientId ?? null,
    currentRentStart: new Date(topMatch.dateFrom),
    currentRentEnd: new Date(topMatch.dateTo),
    activeOccupancyId: topMatch.id,
  };
}
