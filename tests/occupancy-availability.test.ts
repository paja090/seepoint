import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodsOverlap,
  getOverlapDaysCount,
  isSurfaceTechnicallyAvailable,
  getSurfaceAvailabilityState,
  BLOCKING_OCCUPANCY_STATUSES,
  WARNING_OCCUPANCY_STATUSES,
  INACTIVE_OCCUPANCY_STATUSES,
} from '../lib/occupancy/availability-service';

describe('Canonical Occupancy Availability Engine', () => {
  describe('Date Overlap Calculation (Inclusive OOH Standard)', () => {
    it('detects overlap on touching edge dates: 1.10.–15.10. and 15.10.–20.10.', () => {
      const overlaps = periodsOverlap('2026-10-01', '2026-10-15', '2026-10-15', '2026-10-20');
      assert.equal(overlaps, true, 'Campaigns touching on 15.10. both claim the surface on that day and must overlap');
      assert.equal(getOverlapDaysCount('2026-10-01', '2026-10-15', '2026-10-15', '2026-10-20'), 1);
    });

    it('detects no overlap for adjacent separate days: 1.10.–15.10. and 16.10.–20.10.', () => {
      const overlaps = periodsOverlap('2026-10-01', '2026-10-15', '2026-10-16', '2026-10-20');
      assert.equal(overlaps, false, 'Adjacent non-touching dates must not overlap');
      assert.equal(getOverlapDaysCount('2026-10-01', '2026-10-15', '2026-10-16', '2026-10-20'), 0);
    });

    it('detects exact identical period overlap', () => {
      const overlaps = periodsOverlap('2026-11-01', '2026-11-30', '2026-11-01', '2026-11-30');
      assert.equal(overlaps, true);
      assert.equal(getOverlapDaysCount('2026-11-01', '2026-11-30', '2026-11-01', '2026-11-30'), 30);
    });

    it('detects partial overlap when period B starts inside period A', () => {
      const overlaps = periodsOverlap('2026-05-01', '2026-05-20', '2026-05-10', '2026-05-31');
      assert.equal(overlaps, true);
      // Overlap is 10.05 to 20.05 inclusive = 11 days
      assert.equal(getOverlapDaysCount('2026-05-01', '2026-05-20', '2026-05-10', '2026-05-31'), 11);
    });

    it('detects overlap when single day campaigns match', () => {
      const overlaps = periodsOverlap('2026-08-15', '2026-08-15', '2026-08-15', '2026-08-15');
      assert.equal(overlaps, true);
      assert.equal(getOverlapDaysCount('2026-08-15', '2026-08-15', '2026-08-15', '2026-08-15'), 1);
    });

    it('detects no overlap when periods are completely disjoint in time', () => {
      const overlaps1 = periodsOverlap('2026-01-01', '2026-01-31', '2026-03-01', '2026-03-31');
      assert.equal(overlaps1, false);

      const overlaps2 = periodsOverlap('2026-06-01', '2026-06-30', '2026-04-01', '2026-04-30');
      assert.equal(overlaps2, false);
    });

    it('returns false for invalid inverted date intervals', () => {
      const overlaps = periodsOverlap('2026-10-20', '2026-10-10', '2026-10-01', '2026-10-31');
      assert.equal(overlaps, false);
    });
  });

  describe('Technical Availability Checking', () => {
    it('rejects surfaces marked OUT_OF_SERVICE', () => {
      const tech = isSurfaceTechnicallyAvailable({
        status: 'OUT_OF_SERVICE',
        carrier: { status: 'ACTIVE', archivedAt: null },
      });
      assert.equal(tech.isAvailable, false);
      assert.match(tech.reason!, /OUT_OF_SERVICE/);
    });

    it('rejects surfaces on archived carriers', () => {
      const tech = isSurfaceTechnicallyAvailable({
        status: 'AVAILABLE',
        carrier: { status: 'ACTIVE', archivedAt: new Date() },
      });
      assert.equal(tech.isAvailable, false);
      assert.match(tech.reason!, /archivován/);
    });

    it('rejects surfaces on inactive or maintenance carriers', () => {
      const inactive = isSurfaceTechnicallyAvailable({
        status: 'AVAILABLE',
        carrier: { status: 'INACTIVE', archivedAt: null },
      });
      assert.equal(inactive.isAvailable, false);
      assert.match(inactive.reason!, /neaktivní/);

      const maintenance = isSurfaceTechnicallyAvailable({
        status: 'AVAILABLE',
        carrier: { status: 'MAINTENANCE', archivedAt: null },
      });
      assert.equal(maintenance.isAvailable, false);
      assert.match(maintenance.reason!, /údržbě/);
    });

    it('accepts healthy surfaces on active non-archived carriers', () => {
      const tech = isSurfaceTechnicallyAvailable({
        status: 'AVAILABLE',
        carrier: { status: 'ACTIVE', archivedAt: null },
      });
      assert.equal(tech.isAvailable, true);
      assert.equal(tech.reason, undefined);
    });
  });

  describe('Status Categorization Standards', () => {
    it('defines explicit hard blocking statuses', () => {
      assert.ok(BLOCKING_OCCUPANCY_STATUSES.includes('OCCUPIED'));
      assert.ok(BLOCKING_OCCUPANCY_STATUSES.includes('RESERVED'));
      assert.ok(!(BLOCKING_OCCUPANCY_STATUSES as readonly string[]).includes('NEGOTIATION'));
    });

    it('defines explicit soft warning statuses', () => {
      assert.ok(WARNING_OCCUPANCY_STATUSES.includes('NEGOTIATION'));
      assert.ok(!(WARNING_OCCUPANCY_STATUSES as readonly string[]).includes('OCCUPIED'));
    });

    it('defines explicit non-blocking inactive statuses', () => {
      assert.ok(INACTIVE_OCCUPANCY_STATUSES.includes('AVAILABLE'));
      assert.ok(INACTIVE_OCCUPANCY_STATUSES.includes('FINISHED'));
      assert.ok(INACTIVE_OCCUPANCY_STATUSES.includes('CANCELLED'));
    });
  });

  describe('Surface Availability Snapshot State Derivation', () => {
    it('returns AVAILABLE when there are no occupancies at reference date', () => {
      const refDate = new Date('2026-10-15T12:00:00Z');
      const state = getSurfaceAvailabilityState([], refDate);
      assert.equal(state.status, 'AVAILABLE');
      assert.equal(state.currentClientId, null);
      assert.equal(state.activeOccupancyId, null);
    });

    it('prioritizes OUT_OF_SERVICE > OCCUPIED > RESERVED > NEGOTIATION', () => {
      const refDate = new Date('2026-10-15T12:00:00Z');
      const occupancies = [
        {
          id: 'occ-neg',
          clientId: 'client-1',
          status: 'NEGOTIATION' as const,
          dateFrom: new Date('2026-10-01'),
          dateTo: new Date('2026-10-31'),
        },
        {
          id: 'occ-res',
          clientId: 'client-2',
          status: 'RESERVED' as const,
          dateFrom: new Date('2026-10-10'),
          dateTo: new Date('2026-10-20'),
        },
        {
          id: 'occ-occ',
          clientId: 'client-3',
          status: 'OCCUPIED' as const,
          dateFrom: new Date('2026-10-12'),
          dateTo: new Date('2026-10-18'),
        },
      ];

      const state = getSurfaceAvailabilityState(occupancies, refDate);
      assert.equal(state.status, 'OCCUPIED', 'OCCUPIED must override RESERVED and NEGOTIATION');
      assert.equal(state.currentClientId, 'client-3');
      assert.equal(state.activeOccupancyId, 'occ-occ');
    });

    it('ignores FINISHED and CANCELLED occupancies even if date matches', () => {
      const refDate = new Date('2026-10-15T12:00:00Z');
      const occupancies = [
        {
          id: 'occ-fin',
          clientId: 'client-old',
          status: 'FINISHED' as const,
          dateFrom: new Date('2026-10-01'),
          dateTo: new Date('2026-10-31'),
        },
        {
          id: 'occ-canc',
          clientId: 'client-canc',
          status: 'CANCELLED' as const,
          dateFrom: new Date('2026-10-01'),
          dateTo: new Date('2026-10-31'),
        },
      ];

      const state = getSurfaceAvailabilityState(occupancies, refDate);
      assert.equal(state.status, 'AVAILABLE');
      assert.equal(state.currentClientId, null);
    });
  });
});
