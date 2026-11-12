import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeDailyBriefingSettings,
  sanitizeManagerDigestSettings,
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
  assembleManagerMorningDigest,
  renderManagerMorningDigestEmail,
  type WorkerRecipient,
} from '../lib/work/daily-briefing';
import {
  czechFirstNameVocative,
  createBriefingAckToken,
  verifyBriefingAckToken,
} from '../lib/work/briefing-ack';

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
    organizationId: 'org_seepoint_default',
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
  assert.match(pavelBriefing.tasks[0].ackUrl || '', /\/api\/work-orders\/ack-email\?token=/);
  assert.match(pavelBriefing.ackAllUrl || '', /\/api\/work-orders\/ack-email\?token=/);

  const rendered = renderWorkerDailyBriefingEmail(pavelBriefing, 'SeePOINT s.r.o.');
  assert.match(rendered.subject, /Plán práce na zítra/);
  assert.match(rendered.html, /Ahoj <strong[^>]*>Pavle<\/strong>/);
  assert.match(rendered.html, /Vím o úkolu \(Potvrdit\)/);
  assert.match(rendered.html, /Porada nový systém SP/);
  assert.match(rendered.html, /&lt;test&gt;/); // Escaped HTML
  assert.doesNotMatch(rendered.html, /<test>/);
});

test('czechFirstNameVocative conjugates common Czech names and nicknames accurately', () => {
  assert.equal(czechFirstNameVocative('Pavel'), 'Pavle');
  assert.equal(czechFirstNameVocative('Marek'), 'Marku');
  assert.equal(czechFirstNameVocative('Mirek'), 'Mirku');
  assert.equal(czechFirstNameVocative('Miroslav'), 'Miroslave');
  assert.equal(czechFirstNameVocative('Vladimíra'), 'Vladimíro');
  assert.equal(czechFirstNameVocative('Vlaďka'), 'Vlaďko');
  assert.equal(czechFirstNameVocative('Tomáš'), 'Tomáši');
  assert.equal(czechFirstNameVocative('Ondřej'), 'Ondřeji');
  assert.equal(czechFirstNameVocative('Jiří'), 'Jiří');
  assert.equal(czechFirstNameVocative('Jirka'), 'Jirko');
  assert.equal(czechFirstNameVocative('Petr'), 'Petře');
  assert.equal(czechFirstNameVocative('Lenka'), 'Lenko');
  assert.equal(czechFirstNameVocative(''), 'kolego');
});

test('HMAC briefing ack token verifies valid payloads and rejects tampered or expired tokens', () => {
  const secret = 'test-signing-secret-xyz';
  const token = createBriefingAckToken(
    {
      orgId: 'org_seepoint_default',
      orderIds: ['wo-1', 'wo-2'],
      userId: 'user-pavel',
      employeeId: 'emp-pavel',
      workerName: 'Pavel Šubert',
      email: 'subert.pvel@gmail.com',
      ttlDays: 7,
    },
    secret
  );

  const decoded = verifyBriefingAckToken(token, secret);
  assert.ok(decoded);
  assert.equal(decoded.orgId, 'org_seepoint_default');
  assert.deepEqual(decoded.orderIds, ['wo-1', 'wo-2']);
  assert.equal(decoded.workerName, 'Pavel Šubert');

  // Wrong secret -> null
  assert.equal(verifyBriefingAckToken(token, 'wrong-secret'), null);

  // Tampered payload -> null
  const [payloadB64, sigHex] = token.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...decoded, orgId: 'org_other' }),
    'utf8'
  ).toString('base64url');
  assert.equal(verifyBriefingAckToken(`${tamperedPayload}.${sigHex}`, secret), null);
  assert.equal(verifyBriefingAckToken(`${payloadB64}.0000`, secret), null);

  // Expired -> null
  const futureCheck = Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60;
  assert.equal(verifyBriefingAckToken(token, secret, futureCheck), null);
});

test('action tokens distinguish complete and reschedule intents and reject unknown actions', () => {
  const secret = 'test-signing-secret-xyz';
  const completeToken = createBriefingAckToken(
    {
      orgId: 'org_seepoint_default',
      orderIds: ['wo-done-1'],
      action: 'complete',
      workerName: 'Miroslav Mec',
      email: 'mirek.mec@seepoint.cz',
      ttlDays: 7,
    },
    secret
  );
  const rescheduleToken = createBriefingAckToken(
    {
      orgId: 'org_seepoint_default',
      orderIds: ['wo-move-1'],
      action: 'reschedule',
      workerName: 'Miroslav Mec',
      email: 'mirek.mec@seepoint.cz',
      ttlDays: 7,
    },
    secret
  );

  assert.equal(verifyBriefingAckToken(completeToken, secret)?.action, 'complete');
  assert.equal(verifyBriefingAckToken(rescheduleToken, secret)?.action, 'reschedule');

  const [payloadB64, sigHex] = completeToken.split('.');
  const decoded = verifyBriefingAckToken(completeToken, secret)!;
  const bogusPayload = Buffer.from(
    JSON.stringify({ ...decoded, action: 'delete_all' }),
    'utf8'
  ).toString('base64url');
  assert.equal(verifyBriefingAckToken(`${bogusPayload}.${sigHex}`, secret), null);
  assert.ok(payloadB64);
});

test('assembleWorkerBriefings combines today unfinished tasks with tomorrow plan in one email even when tomorrow is empty', () => {
  const result = assembleWorkerBriefings({
    organizationId: 'org_seepoint_default',
    todayDate: '2026-11-11',
    targetDate: '2026-11-12',
    baseUrl: 'https://seepoint.cz',
    directory: DIRECTORY,
    todayOrders: [
      {
        id: 'wo-today-mirek',
        title: 'Instalace banneru Ostrava – 10:00',
        description: null,
        workType: 'INSTALLATION',
        priority: 'HIGH',
        status: 'PLANNED',
        scheduledAt: new Date('2026-11-11T09:00:00.000Z'),
        clientName: 'Klient Dnes s.r.o.',
        contactName: null,
        contactPhone: null,
        locationNote: 'Stodolní 1, Ostrava',
        quantity: 2,
        mediaLabel: null,
        ftdUrl: null,
        referenceUrl: null,
        pdfUrl: null,
        planningConstraints: null,
        assignments: [{ userId: null, workerName: 'Mirek' }],
      },
      {
        id: 'wo-today-pavel',
        title: 'Revize podkladů',
        description: null,
        workType: 'OTHER',
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        scheduledAt: new Date('2026-11-11T12:00:00.000Z'),
        clientName: 'Interní',
        contactName: null,
        contactPhone: null,
        locationNote: null,
        quantity: null,
        mediaLabel: null,
        ftdUrl: null,
        referenceUrl: null,
        pdfUrl: null,
        planningConstraints: null,
        assignments: [{ userId: null, workerName: 'Pavel' }],
      },
    ],
    orders: [
      {
        id: 'wo-tomorrow-mirek',
        title: 'Polep CLV Brno',
        description: null,
        workType: 'INSTALLATION',
        priority: 'NORMAL',
        status: 'PLANNED',
        scheduledAt: new Date('2026-11-12T07:00:00.000Z'),
        clientName: 'Brno Klient',
        contactName: null,
        contactPhone: null,
        locationNote: 'Brno střed',
        quantity: 3,
        mediaLabel: null,
        ftdUrl: null,
        referenceUrl: null,
        pdfUrl: null,
        planningConstraints: null,
        assignments: [{ userId: null, workerName: 'Mirek' }],
      },
    ],
    fieldPlans: [],
  });

  // Both Mirek (today + tomorrow) and Pavel (today only) receive a briefing
  assert.equal(result.briefings.length, 2);

  const mirek = result.briefings.find((b) => b.recipient.email === 'mirek.mec@seepoint.cz')!;
  assert.equal(mirek.todayOpenTasks?.length, 1);
  assert.equal(mirek.tasks.length, 1);
  assert.match(mirek.todayOpenTasks![0].completeUrl || '', /\/api\/work-orders\/email-action\?token=/);
  assert.match(mirek.todayOpenTasks![0].rescheduleUrl || '', /\/api\/work-orders\/email-action\?token=/);

  const renderedMirek = renderWorkerDailyBriefingEmail(mirek, 'SeePOINT s.r.o.');
  assert.match(renderedMirek.subject, /Uzavření dneška \(1\) & plán na zítra/);
  assert.match(renderedMirek.html, /Kontrola dneška/);
  assert.match(renderedMirek.html, /✅ Hotovo/);
  assert.match(renderedMirek.html, /⏳ Nestihl jsem \/ Přesunout/);
  assert.match(renderedMirek.html, /Plán práce na zítřek/);

  const pavel = result.briefings.find((b) => b.recipient.email === 'subert.pvel@gmail.com')!;
  assert.equal(pavel.todayOpenTasks?.length, 1);
  assert.equal(pavel.tasks.length, 0);
  const renderedPavel = renderWorkerDailyBriefingEmail(pavel, 'SeePOINT s.r.o.');
  assert.match(renderedPavel.subject, /Uzavření dnešních úkolů/);
  assert.match(renderedPavel.html, /zatím nemáš v systému přiřazené žádné další úkoly/);
});

test('sanitizeManagerDigestSettings and assembleManagerMorningDigest track unfinished, worker-rescheduled, and completed orders for audited day only', () => {
  const defaultManager = sanitizeManagerDigestSettings(undefined, 'org_seepoint_default');
  assert.deepEqual(defaultManager, {
    enabled: true,
    sendHourLocal: 7,
    timezone: 'Europe/Prague',
    skipWeekends: false,
  });

  const digest = assembleManagerMorningDigest({
    auditedDate: '2026-11-11',
    baseUrl: 'https://seepoint.cz',
    yesterdayOrders: [
      {
        id: 'wo-open',
        title: 'Nedodělaný polep',
        clientName: 'Klient A',
        status: 'PLANNED',
        scheduledAt: new Date('2026-11-11T07:00:00.000Z'),
        updatedAt: new Date('2026-11-11T07:00:00.000Z'),
        planningConstraints: null,
        assignments: [{ workerName: 'Jirka' }],
      },
      {
        id: 'wo-done',
        title: 'Dokončený výlep',
        clientName: 'Klient B',
        status: 'DONE',
        scheduledAt: new Date('2026-11-11T07:00:00.000Z'),
        updatedAt: new Date('2026-11-11T16:10:00.000Z'),
        planningConstraints: { lastWorkerNote: 'Předáno bez vad' },
        assignments: [{ workerName: 'Mirek' }],
      },
    ],
    recentRescheduledOrders: [
      {
        id: 'wo-moved-from-yesterday',
        title: 'Odložená montáž',
        clientName: 'Klient C',
        status: 'PLANNED',
        scheduledAt: new Date('2026-11-12T07:00:00.000Z'),
        updatedAt: new Date('2026-11-11T16:30:00.000Z'),
        planningConstraints: {
          sheetScheduledDateAtReschedule: '2026-11-11',
          manualScheduledDateIso: '2026-11-12',
          lastEmailAction: 'RESCHEDULED',
          lastWorkerReason: 'Počasí / déšť – Pršelo',
          lastWorkerReportBy: 'Mirek',
          lastWorkerReportAt: '2026-11-11T16:30:00.000Z',
        },
        assignments: [{ workerName: 'Mirek' }],
      },
      {
        id: 'wo-stale-from-earlier-week',
        title: 'Starší přesun z minulého týdne',
        clientName: 'Klient Old',
        status: 'PLANNED',
        scheduledAt: new Date('2026-11-14T07:00:00.000Z'),
        updatedAt: new Date('2026-11-08T16:00:00.000Z'),
        planningConstraints: {
          sheetScheduledDateAtReschedule: '2026-11-08',
          lastEmailAction: 'RESCHEDULED',
          lastWorkerReason: 'Starý důvod',
          lastWorkerReportAt: '2026-11-08T16:00:00.000Z',
        },
        assignments: [{ workerName: 'Jirka' }],
      },
    ],
  });

  assert.equal(digest.unfinishedItems.length, 1);
  assert.equal(digest.completedItems.length, 1);
  assert.equal(digest.rescheduledItems.length, 1);
  assert.equal(digest.rescheduledItems[0].workOrderId, 'wo-moved-from-yesterday');
  assert.equal(digest.rescheduledItems[0].workerReason, 'Počasí / déšť – Pršelo');

  const rendered = renderManagerMorningDigestEmail(digest, 'SeePOINT s.r.o.');
  assert.match(rendered.subject, /1 neuzavřeno, 1 přesunuto/);
  assert.match(rendered.html, /Odložená montáž/);
  assert.match(rendered.html, /Počasí \/ déšť – Pršelo/);
  assert.match(rendered.html, /Nedodělaný polep/);
  assert.doesNotMatch(rendered.html, /Starší přesun z minulého týdne/);
});
