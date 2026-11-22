import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  extractWorkOrderEmailAction,
  formatOverdueDaysLabel,
  getWorkOrderOverdueInfo,
  isWorkOrderOverdue,
} from '@/lib/work/overdue';
import {
  assembleManagerMorningDigest,
  renderManagerMorningDigestEmail,
} from '@/lib/work/daily-briefing';
import {
  getSurfaceAvailabilityState,
  isReservationHoldExpired,
} from '@/lib/occupancy/availability-service';
import {
  matchSurface,
  parseOccupancyImportDates,
  parseOccupancyImportStatus,
  type ExistingSurfaceRecord,
} from '@/lib/imports/matching';
import {
  classifyExpirationUrgency,
  formatExpirationBadgeText,
  renderExpirationDigestEmail,
} from '@/lib/occupancy/expiration-alerts';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

test('WorkOrder unified overdue detection covers both scheduledAt and deadlineAt consistently', () => {
  const now = new Date(2026, 10, 22, 14, 0, 0); // 2026-11-22 14:00 local

  // Open task scheduled 3 days ago with NO deadlineAt (typical Google Sheet task) -> OVERDUE!
  const sheetOverdue = getWorkOrderOverdueInfo(
    { status: 'PLANNED', scheduledAt: new Date(2026, 10, 19, 9, 0, 0), deadlineAt: null },
    now
  );
  assert.equal(sheetOverdue.isOverdue, true);
  assert.equal(sheetOverdue.overdueDays, 3);
  assert.equal(sheetOverdue.overdueSource, 'scheduled');
  assert.equal(formatOverdueDaysLabel(sheetOverdue.overdueDays), '3 dny');

  // Task scheduled today (morning) with no deadline -> NOT overdue yet
  const todayTask = getWorkOrderOverdueInfo(
    { status: 'IN_PROGRESS', scheduledAt: new Date(2026, 10, 22, 8, 0, 0), deadlineAt: null },
    now
  );
  assert.equal(todayTask.isOverdue, false);
  assert.equal(todayTask.overdueDays, 0);

  // Task scheduled today, explicit deadline passed 2 hours ago -> OVERDUE by deadline
  const deadlinePassed = getWorkOrderOverdueInfo(
    {
      status: 'PLANNED',
      scheduledAt: new Date(2026, 10, 22, 8, 0, 0),
      deadlineAt: new Date(2026, 10, 22, 12, 0, 0),
    },
    now
  );
  assert.equal(deadlinePassed.isOverdue, true);
  assert.equal(deadlinePassed.overdueSource, 'deadline');

  // Completed or cancelled tasks are NEVER overdue
  assert.equal(
    isWorkOrderOverdue({ status: 'DONE', scheduledAt: new Date(2026, 10, 10), deadlineAt: null }, now),
    false
  );
  assert.equal(
    isWorkOrderOverdue({ status: 'CANCELLED', scheduledAt: new Date(2026, 10, 10), deadlineAt: null }, now),
    false
  );
});

test('extractWorkOrderEmailAction surfaces COMPLETED, RESCHEDULED, and REPORTED_UNFINISHED metadata cleanly', () => {
  const completed = extractWorkOrderEmailAction({
    lastEmailAction: 'COMPLETED',
    lastWorkerReportBy: 'Mirek',
    lastWorkerReportAt: '2026-11-21T16:30:00.000Z',
    lastWorkerNote: 'Hotovo včetně fotek',
  });
  assert.ok(completed);
  assert.equal(completed.action, 'COMPLETED');
  assert.equal(completed.actorName, 'Mirek');
  assert.equal(completed.reason, 'Hotovo včetně fotek');

  const reported = extractWorkOrderEmailAction({
    lastEmailAction: 'REPORTED_UNFINISHED',
    lastWorkerReportBy: 'Ondra',
    lastWorkerReason: 'Silný déšť',
  });
  assert.ok(reported);
  assert.equal(reported.action, 'REPORTED_UNFINISHED');
  assert.equal(reported.reason, 'Silný déšť');

  assert.equal(extractWorkOrderEmailAction({ source: 'GOOGLE_SHEETS_PLAN' }), null);
});

test('Manager Morning Digest includes older unrescheduled overdue tasks from earlier days', () => {
  const digest = assembleManagerMorningDigest({
    auditedDate: '2026-11-21',
    yesterdayOrders: [
      {
        id: 'wo-yest',
        title: 'Výlep billboardu',
        clientName: 'Kofola',
        status: 'PLANNED',
        scheduledAt: new Date('2026-11-21T08:00:00Z'),
        updatedAt: new Date('2026-11-21T08:00:00Z'),
        planningConstraints: null,
        assignments: [{ workerName: 'Mirek' }],
      },
    ],
    olderOverdueOrders: [
      {
        id: 'wo-old',
        title: 'Instalace šipky P3',
        clientName: 'Auto Kelly',
        status: 'IN_PROGRESS',
        scheduledAt: new Date('2026-11-17T08:00:00Z'),
        updatedAt: new Date('2026-11-17T08:00:00Z'),
        planningConstraints: { lastWorkerReason: 'Čekáme na povolení' },
        assignments: [{ workerName: 'Jirka' }],
      },
      // Done task in olderOverdueOrders must be excluded
      {
        id: 'wo-old-done',
        title: 'Hotová stará',
        clientName: 'Test',
        status: 'DONE',
        scheduledAt: new Date('2026-11-16T08:00:00Z'),
        updatedAt: new Date('2026-11-16T08:00:00Z'),
        planningConstraints: null,
        assignments: [],
      },
    ],
    baseUrl: 'https://seepoint.vercel.app',
  });

  assert.equal(digest.unfinishedItems.length, 1);
  assert.equal(digest.olderOverdueItems?.length, 1);
  assert.equal(digest.olderOverdueItems?.[0].workOrderId, 'wo-old');
  assert.equal(digest.olderOverdueItems?.[0].workerReason, 'Čekáme na povolení');

  const rendered = renderManagerMorningDigestEmail(digest, 'SeePoint');
  assert.match(rendered.subject, /1 starších po termínu/);
  assert.match(rendered.html, /Starší nepřeplánované úkoly po termínu \(1\)/);
  assert.match(rendered.html, /Instalace šipky P3/);
  assert.match(rendered.html, /\?filter=overdue/);
  assert.match(rendered.text, /STARŠÍ PO TERMÍNU/);
});

test('getSurfaceAvailabilityState fixes same-day UTC boundary and ignores expired reservation holds', () => {
  // Reference time at 14:30 UTC on 2026-11-22; campaign ends 2026-11-22T00:00:00.000Z -> MUST STILL BE OCCUPIED today!
  const ref = new Date('2026-11-22T14:30:00.000Z');
  const stateEndingToday = getSurfaceAvailabilityState(
    [
      {
        id: 'occ-1',
        clientId: 'cli-1',
        status: 'OCCUPIED',
        dateFrom: new Date('2026-11-01T00:00:00.000Z'),
        dateTo: new Date('2026-11-22T00:00:00.000Z'),
      },
    ],
    ref
  );
  assert.equal(stateEndingToday.status, 'OCCUPIED');
  assert.equal(stateEndingToday.currentClientId, 'cli-1');

  // Expired reservation hold (reservedUntil = yesterday) must NOT hold the surface as RESERVED
  const expiredHold = {
    id: 'occ-exp',
    clientId: 'cli-2',
    status: 'RESERVED' as const,
    dateFrom: new Date('2026-12-01T00:00:00.000Z'),
    dateTo: new Date('2026-12-31T00:00:00.000Z'),
    reservedUntil: new Date('2026-11-21T00:00:00.000Z'),
  };
  assert.equal(isReservationHoldExpired(expiredHold, ref), true);
  const stateExpiredHold = getSurfaceAvailabilityState([expiredHold], ref);
  assert.equal(stateExpiredHold.status, 'AVAILABLE');
  assert.equal(stateExpiredHold.currentClientId, null);

  // Active reservation hold (reservedUntil = tomorrow) keeps surface RESERVED
  const activeHold = {
    ...expiredHold,
    reservedUntil: new Date('2026-11-23T00:00:00.000Z'),
  };
  assert.equal(isReservationHoldExpired(activeHold, ref), false);
  const stateActiveHold = getSurfaceAvailabilityState([activeHold], ref);
  assert.equal(stateActiveHold.status, 'RESERVED');
});

test('Bulk occupancy import surface targeting (Side A/B) and Czech date/status parsers work accurately', () => {
  const surfaces: ExistingSurfaceRecord[] = [
    { id: 's-a', carrierId: 'c1', name: 'Strana A (směr centrum)', mediaType: 'BILLBOARD', sidePosition: 'A', sourceKey: null },
    { id: 's-b', carrierId: 'c1', name: 'Strana B (výjezd)', mediaType: 'BILLBOARD', sidePosition: 'B', sourceKey: null },
  ];

  // Explicit side B matches surface B
  const mB = matchSurface(surfaces, { sidePosition: 'B' });
  assert.equal(mB.status, 'MATCHED');
  if (mB.status === 'MATCHED') assert.equal(mB.surface.id, 's-b');

  // Numeric alias "1" maps to side A
  const m1 = matchSurface(surfaces, { sidePosition: '1' });
  assert.equal(m1.status, 'MATCHED');
  if (m1.status === 'MATCHED') assert.equal(m1.surface.id, 's-a');

  // Partial surface name "výjezd" matches side B
  const mPartial = matchSurface(surfaces, { surfaceName: 'výjezd' });
  assert.equal(mPartial.status, 'MATCHED');
  if (mPartial.status === 'MATCHED') assert.equal(mPartial.surface.id, 's-b');

  // Missing side on double-sided carrier is AMBIGUOUS (never silently writes to surface[0]!)
  const mAmb = matchSurface(surfaces, {});
  assert.equal(mAmb.status, 'AMBIGUOUS');

  // Date & monthSlot parsing
  const czDates = parseOccupancyImportDates({ dateFrom: '1.11.2026', dateTo: '30.11.2026' });
  assert.ok(czDates);
  assert.equal(czDates.dateFrom.toISOString().slice(0, 10), '2026-11-01');
  assert.equal(czDates.dateTo.toISOString().slice(0, 10), '2026-11-30');

  const slotDates = parseOccupancyImportDates({ monthSlot: 'Prosinec 2026' }, 2026);
  assert.ok(slotDates);
  assert.equal(slotDates.dateFrom.toISOString().slice(0, 10), '2026-12-01');
  assert.equal(slotDates.dateTo.toISOString().slice(0, 10), '2026-12-31');

  // Status parsing
  assert.equal(
    parseOccupancyImportStatus('Potvrzeno', czDates.dateFrom, czDates.dateTo, new Date('2026-11-10T00:00:00Z')),
    'OCCUPIED'
  );
  assert.equal(
    parseOccupancyImportStatus('Opce', czDates.dateFrom, czDates.dateTo, new Date('2026-11-10T00:00:00Z')),
    'NEGOTIATION'
  );
});

test('Expiration urgency classification and digest email renderer cover all 4 expiration categories', () => {
  const ref = new Date('2026-11-22T10:00:00Z');
  assert.deepEqual(classifyExpirationUrgency('2026-11-20', ref), { daysRemaining: -2, urgency: 'EXPIRED' });
  assert.deepEqual(classifyExpirationUrgency('2026-11-25', ref), { daysRemaining: 3, urgency: 'URGENT' });
  assert.deepEqual(classifyExpirationUrgency('2026-12-03', ref), { daysRemaining: 11, urgency: 'WARNING' });
  assert.deepEqual(classifyExpirationUrgency('2026-12-15', ref), { daysRemaining: 23, urgency: 'UPCOMING' });
  assert.equal(formatExpirationBadgeText(0), 'Vyprší dnes');
  assert.equal(formatExpirationBadgeText(-2), 'Vypršelo před 2 dny');

  const rendered = renderExpirationDigestEmail(
    {
      organizationId: 'org-1',
      evaluatedDate: '2026-11-22',
      items: [
        {
          id: 'lease-1',
          category: 'OCCUPANCY_LEASE',
          urgency: 'URGENT',
          daysRemaining: 4,
          expiresAt: '2026-11-26',
          title: 'Konec pronájmu: Kofola · BB-01',
          subtitle: 'Podzim 2026 · Strana A (Ostrava)',
          link: '/occupancy',
        },
        {
          id: 'permit-1',
          category: 'CARRIER_PERMIT',
          urgency: 'EXPIRED',
          daysRemaining: -1,
          expiresAt: '2026-11-21',
          title: 'Povolení nosiče: BB-02 (Brno)',
          subtitle: 'Vídeňská',
          link: '/carriers/c-2',
        },
      ],
      counts: {
        total: 2,
        expired: 1,
        urgent: 1,
        warning: 0,
        upcoming: 0,
        byCategory: {
          OCCUPANCY_LEASE: 1,
          RESERVATION_HOLD: 0,
          CLIENT_CONTRACT: 0,
          CARRIER_PERMIT: 1,
        },
      },
    },
    'SeePoint s.r.o.'
  );

  assert.match(rendered.subject, /2 urgentních \/ prošlých/);
  assert.match(rendered.html, /Konce pronájmů a kampaní/);
  assert.match(rendered.html, /Konce povolení nosičů/);
  assert.match(rendered.text, /Kofola/);
});

test('Contract checks: WorkModuleClient keeps overdue in Dnes filter, surface client API enforces 409 collisions, import wizard keys conflicts by rowId', () => {
  const workClientSrc = read('components/WorkModuleClient.tsx');
  assert.match(workClientSrc, /selectedFilter === 'overdue'/);
  assert.match(workClientSrc, /selectedFilter === 'today'\).*overdue/);

  const surfaceClientRoute = read('app/api/surfaces/[id]/client/route.ts');
  assert.match(surfaceClientRoute, /Kolize obsazenosti/);
  assert.match(surfaceClientRoute, /conflictErr\.statusCode = 409/);

  const bulkRoute = read('app/api/occupancy/bulk/route.ts');
  assert.match(bulkRoute, /syncSurfaceOccupancyState\(surfaceId, tx\)/);

  const importWizard = read('components/imports/UniversalImportWizard.tsx');
  assert.match(importWizard, /row\.rowId \|\| String\(row\.rowNumber\)/);
  assert.match(importWizard, /createdOccupancies/);
});
