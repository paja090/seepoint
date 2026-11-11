import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeDailyBriefingSettings,
  normalizeCzechName,
  isDeliverableWorkerEmail,
  getLocalHour,
  addCalendarDays,
  getTomorrowDateStr,
  isWeekendDate,
  getDayBoundsUtc,
  formatCzechFullDate,
  matchWorkerAssignment,
  assembleWorkerBriefings,
  renderWorkerDailyBriefingEmail,
  type WorkerRecipient,
} from '../lib/work/daily-briefing';

const DIRECTORY: WorkerRecipient[] = [
  {
    key: 'emp-vladka',
    employeeId: 'emp-vladka',
    userId: 'user-vladka',
    fullName: 'Vladimíra Konečná',
    firstName: 'Vladimíra',
    lastName: 'Konečná',
    email: 'vladka.konecna@seepoint.cz',
    role: 'MANAGER',
  },
  {
    key: 'emp-mirek',
    employeeId: 'emp-mirek',
    userId: 'user-mirek',
    fullName: 'Miroslav Mec',
    firstName: 'Miroslav',
    lastName: 'Mec',
    email: 'mirek.mec@seepoint.cz',
    role: 'SALES',
  },
  {
    key: 'emp-marek-s',
    employeeId: 'emp-marek-s',
    userId: 'user-marek-s',
    fullName: 'Marek Slapnička',
    firstName: 'Marek',
    lastName: 'Slapnička',
    email: 'marek.slapn@gmail.com',
    role: 'TECHNICIAN',
  },
  {
    key: 'emp-marek-k',
    employeeId: 'emp-marek-k',
    userId: 'user-marek-k',
    fullName: 'Marek Konečný',
    firstName: 'Marek',
    lastName: 'Konečný',
    email: 'marek.konecny@seepoint.cz',
    role: 'MANAGER',
  },
  {
    key: 'emp-pavel',
    employeeId: 'emp-pavel',
    userId: 'user-pavel',
    fullName: 'Pavel Šubert',
    firstName: 'Pavel',
    lastName: 'Šubert',
    email: 'subert.pvel@gmail.com',
    role: 'ADMIN',
  },
  {
    key: 'emp-jiri',
    employeeId: 'emp-jiri',
    userId: 'user-jiri',
    fullName: 'Jiří Zdeněk',
    firstName: 'Jiří',
    lastName: 'Zdeněk',
    email: 'jizdenek@email.cz',
    role: 'MANAGER',
  },
];

test('sanitizeDailyBriefingSettings applies tenant-safe defaults and bounds', () => {
  const seepointDefault = sanitizeDailyBriefingSettings(undefined, 'org_seepoint_default');
  assert.deepEqual(seepointDefault, {
    enabled: true,
    sendHourLocal: 17,
    timezone: 'Europe/Prague',
    skipWeekends: false,
  });

  const otherTenantDefault = sanitizeDailyBriefingSettings(undefined, 'org_other');
  assert.equal(otherTenantDefault.enabled, false);

  const clamped = sanitizeDailyBriefingSettings(
    { enabled: true, sendHourLocal: 29, timezone: 'Invalid/Zone', skipWeekends: true },
    'org_other'
  );
  assert.equal(clamped.sendHourLocal, 23);
  assert.equal(clamped.timezone, 'Europe/Prague');
  assert.equal(clamped.skipWeekends, true);
});

test('date helpers compute Prague tomorrow date, local hour, and DST-aware bounds accurately', () => {
  // Winter time (CET = UTC+1): 16:00 UTC == 17:00 Prague
  const winterTime = new Date('2026-11-11T16:00:00.000Z');
  assert.equal(getLocalHour(winterTime, 'Europe/Prague'), 17);
  assert.equal(getTomorrowDateStr(winterTime, 'Europe/Prague'), '2026-11-12');

  // Summer time (CEST = UTC+2): 15:00 UTC == 17:00 Prague
  const summerTime = new Date('2026-07-10T15:00:00.000Z');
  assert.equal(getLocalHour(summerTime, 'Europe/Prague'), 17);
  assert.equal(getTomorrowDateStr(summerTime, 'Europe/Prague'), '2026-07-11');

  assert.equal(addCalendarDays('2026-11-30', 1), '2026-12-01');
  assert.equal(isWeekendDate('2026-11-14'), true); // Saturday
  assert.equal(isWeekendDate('2026-11-15'), true); // Sunday
  assert.equal(isWeekendDate('2026-11-12'), false); // Thursday

  const bounds = getDayBoundsUtc('2026-11-12', 'Europe/Prague');
  assert.equal(bounds.start.toISOString(), '2026-11-11T23:00:00.000Z');
  assert.equal(bounds.end.toISOString(), '2026-11-12T23:00:00.000Z');

  assert.match(formatCzechFullDate('2026-11-12'), /12\. 11\. 2026/);
});

test('isDeliverableWorkerEmail rejects fake/invalid test domains and allows valid addresses', () => {
  assert.equal(isDeliverableWorkerEmail('mirek.mec@seepoint.cz'), true);
  assert.equal(isDeliverableWorkerEmail('qx.audit.admin@example.invalid'), false);
  assert.equal(isDeliverableWorkerEmail('someone@example.com'), false);
  assert.equal(isDeliverableWorkerEmail('not-an-email'), false);
  assert.equal(isDeliverableWorkerEmail(null), false);
});

test('matchWorkerAssignment resolves Czech diminutives, full names, initials, and userIds', () => {
  assert.equal(normalizeCzechName('Vlaďka'), 'vladka');

  // Direct userId
  const byId = matchWorkerAssignment({ userId: 'user-pavel', workerName: 'Anyone' }, DIRECTORY);
  assert.deepEqual(byId.map((m) => m.email), ['subert.pvel@gmail.com']);

  // Czech diminutives from Google Sheets
  assert.deepEqual(
    matchWorkerAssignment({ workerName: 'Vlaďka' }, DIRECTORY).map((m) => m.email),
    ['vladka.konecna@seepoint.cz']
  );
  assert.deepEqual(
    matchWorkerAssignment({ workerName: 'Mirek' }, DIRECTORY).map((m) => m.email),
    ['mirek.mec@seepoint.cz']
  );
  assert.deepEqual(
    matchWorkerAssignment({ workerName: 'Jirka' }, DIRECTORY).map((m) => m.email),
    ['jizdenek@email.cz']
  );

  // Initial disambiguation between two Mareks
  assert.deepEqual(
    matchWorkerAssignment({ workerName: 'Marek S.' }, DIRECTORY).map((m) => m.email),
    ['marek.slapn@gmail.com']
  );
  assert.deepEqual(
    matchWorkerAssignment({ workerName: 'Marek K.' }, DIRECTORY).map((m) => m.email),
    ['marek.konecny@seepoint.cz']
  );

  // Unknown external/unlinked name returns empty array
  assert.deepEqual(matchWorkerAssignment({ workerName: 'Karel' }, DIRECTORY), []);
});

test('assembleWorkerBriefings merges FieldPlan crew stops with standalone WorkOrders without duplicating', () => {
  const result = assembleWorkerBriefings({
    targetDate: '2026-11-12',
    baseUrl: 'https://seepoint.cz',
    directory: DIRECTORY,
    orders: [
      {
        id: 'wo-route-1',
        title: 'MOaP – CP - reinstalace 5 ks viz. databáze',
        description: 'Přehodit 5 plachet v centru Ostravy',
        workType: 'REINSTALLATION',
        priority: 'HIGH',
        status: 'PLANNED',
        scheduledAt: new Date('2026-11-12T07:00:00.000Z'),
        clientName: 'MOaP',
        contactName: 'Pan Novák',
        contactPhone: '+420 777 111 222',
        locationNote: 'Masarykovo náměstí, Ostrava',
        quantity: 5,
        mediaLabel: 'CityPoster',
        ftdUrl: '11 12 MOaP CP reinstalace',
        referenceUrl: null,
        pdfUrl: null,
        planningConstraints: { latitude: 49.835, longitude: 18.292 },
        assignments: [{ userId: null, workerName: 'Mirek' }],
      },
      {
        id: 'wo-meeting',
        title: 'Porada nový systém SP – 9:00',
        description: 'Porada k systému a expedici <test>',
        workType: 'OTHER',
        priority: 'URGENT',
        status: 'PLANNED',
        scheduledAt: new Date('2026-11-12T07:00:00.000Z'),
        clientName: 'SeePOINT',
        contactName: null,
        contactPhone: null,
        locationNote: 'Kancelář Ostrava',
        quantity: null,
        mediaLabel: null,
        ftdUrl: null,
        referenceUrl: null,
        pdfUrl: null,
        planningConstraints: null,
        assignments: [
          { userId: null, workerName: 'Pavel' },
          { userId: null, workerName: 'Vlaďka' },
          { userId: null, workerName: 'Karel' },
        ],
      },
    ],
    fieldPlans: [
      {
        id: 'fp-1',
        date: '2026-11-12',
        status: 'APPROVED',
        version: 1,
        planningSummary: {
          crews: [
            {
              employeeIds: ['emp-mirek'],
              names: ['Miroslav Mec'],
              vehicleName: 'Dodávka Boxer',
              stops: [
                {
                  jobId: 'job-1',
                  workOrderId: 'wo-route-1',
                  routeOrder: 1,
                  arrivalAt: '2026-11-12T07:15:00.000Z', // 08:15 CET
                  title: 'MOaP – CP - reinstalace 5 ks',
                  address: 'Masarykovo náměstí 1, Ostrava',
                  location: { latitude: 49.835, longitude: 18.292 },
                },
              ],
            },
          ],
        },
      },
    ],
  });

  assert.equal(result.targetDate, '2026-11-12');
  assert.deepEqual(result.unmatchedWorkerNames, ['Karel']);
  assert.equal(result.briefings.length, 3); // Miroslav, Pavel, Vladimíra

  const mirekBriefing = result.briefings.find((b) => b.recipient.email === 'mirek.mec@seepoint.cz')!;
  assert.ok(mirekBriefing);
  assert.equal(mirekBriefing.tasks.length, 1); // deduplicated (in both FieldPlan & WorkOrder)
  assert.equal(mirekBriefing.tasks[0].routeOrder, 1);
  assert.equal(mirekBriefing.tasks[0].scheduledTimeLabel, '08:15');
  assert.equal(mirekBriefing.tasks[0].vehicleName, 'Dodávka Boxer');
  assert.equal(
    mirekBriefing.tasks[0].driveUrl,
    'https://drive.google.com/drive/search?q=11%2012%20MOaP%20CP%20reinstalace'
  );
  assert.equal(
    mirekBriefing.tasks[0].mapsUrl,
    'https://www.google.com/maps/search/?api=1&query=49.835,18.292'
  );
  assert.equal(mirekBriefing.routeUrl, 'https://seepoint.cz/my-route?date=2026-11-12');

  const pavelBriefing = result.briefings.find((b) => b.recipient.email === 'subert.pvel@gmail.com')!;
  assert.ok(pavelBriefing);
  assert.equal(pavelBriefing.tasks.length, 1);
  assert.equal(pavelBriefing.tasks[0].scheduledTimeLabel, '9:00');
  assert.deepEqual(pavelBriefing.tasks[0].crewNames, ['Vlaďka', 'Karel']);

  const rendered = renderWorkerDailyBriefingEmail(pavelBriefing, 'SeePOINT s.r.o.');
  assert.match(rendered.subject, /Plán práce na zítra/);
  assert.match(rendered.html, /Porada nový systém SP/);
  assert.match(rendered.html, /&lt;test&gt;/); // Escaped HTML
  assert.doesNotMatch(rendered.html, /<test>/);
});
