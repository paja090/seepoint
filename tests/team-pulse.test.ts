import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchWorkerToMember,
  buildCompanyAndMemberDailyPulse,
  extractMeetingStructuredFallback,
  renderMeetingReportEmail,
  sanitizeMeetingReports,
  type PulseMemberRef,
  type PulseOrderInput,
  type PulseWorkEntryInput,
} from '../lib/planner/team-pulse';

const mockMembers: PulseMemberRef[] = [
  { userId: 'u-mirek', name: 'Miroslav Novák', employeeId: 'emp-mirek' },
  { userId: 'u-vladka', name: 'Vladimíra Dvořáková', employeeId: 'emp-vladka' },
  { userId: 'u-jirka', name: 'Jiří Svoboda', employeeId: 'emp-jirka' },
  { userId: 'u-pavel', name: 'Pavel Černý', employeeId: 'emp-pavel' },
];

test('matchWorkerToMember correctly resolves Czech nicknames and diacritics', () => {
  const match1 = matchWorkerToMember({ userId: null, workerName: 'Mirek' }, mockMembers);
  assert.equal(match1?.userId, 'u-mirek');

  const match2 = matchWorkerToMember({ userId: null, workerName: 'Vlaďka' }, mockMembers);
  assert.equal(match2?.userId, 'u-vladka');

  const match3 = matchWorkerToMember({ userId: null, workerName: 'Jirka' }, mockMembers);
  assert.equal(match3?.userId, 'u-jirka');

  const matchDirectId = matchWorkerToMember({ userId: 'u-pavel', workerName: 'Neznámý' }, mockMembers);
  assert.equal(matchDirectId?.userId, 'u-pavel');
});

test('buildCompanyAndMemberDailyPulse computes stats and maps tasks to team members', () => {
  const orders: PulseOrderInput[] = [
    {
      id: 'ord-1',
      title: 'Výlep billboardu Tesco',
      clientName: 'Tesco a.s.',
      status: 'DONE',
      scheduledAt: new Date('2026-11-12T08:00:00Z'),
      updatedAt: new Date('2026-11-12T10:00:00Z'),
      planningConstraints: { completedViaEmailAt: '2026-11-12T10:00:00Z', lastWorkerNote: 'Hotovo v pořádku' },
      assignments: [{ userId: 'u-mirek', workerName: 'Mirek' }],
    },
    {
      id: 'ord-2',
      title: 'Montáž vitríny Globus',
      clientName: 'Globus',
      status: 'IN_PROGRESS',
      scheduledAt: new Date('2026-11-12T08:00:00Z'),
      updatedAt: new Date('2026-11-12T08:00:00Z'),
      planningConstraints: {
        dailyBriefingAck: { 'ord-2': { workerName: 'Vlaďka', acknowledgedAt: '2026-11-12T07:30:00Z' } },
      },
      assignments: [{ userId: null, workerName: 'Vlaďka' }],
    },
    {
      id: 'ord-3',
      title: 'Demontáž plachty Kaufland',
      clientName: 'Kaufland',
      status: 'PLANNED',
      scheduledAt: new Date('2026-11-13T08:00:00Z'),
      updatedAt: new Date('2026-11-12T09:00:00Z'),
      planningConstraints: {
        sheetScheduledDateAtReschedule: '2026-11-12',
        lastWorkerReason: 'Silný vítr na místě',
      },
      assignments: [{ userId: 'u-jirka', workerName: 'Jirka' }],
    },
  ];

  const workEntries: PulseWorkEntryInput[] = [
    {
      id: 'we-1',
      employeeId: 'emp-mirek',
      workOrderId: 'ord-1',
      workTaskId: 'wt-1',
      clientName: 'Tesco a.s.',
      remunerationMethod: 'HOURLY',
      quantity: 3.5,
      unit: 'hod',
      note: 'Vylepeno 2 ks',
    },
  ];

  const result = buildCompanyAndMemberDailyPulse({
    date: '2026-11-12',
    timezone: 'Europe/Prague',
    members: mockMembers,
    orders,
    workEntries,
  });

  const pulse = result.companyPulse;
  assert.equal(pulse.completedCount, 1);
  assert.equal(pulse.activeCount, 1);
  assert.equal(pulse.acknowledgedCount, 1);
  assert.equal(pulse.rescheduledCount, 1);
  assert.equal(pulse.loggedHoursTotal, 3.5);

  const mirekActivity = result.byUserId['u-mirek'];
  assert.equal(mirekActivity.completedTasks.length, 1);
  assert.equal(mirekActivity.completedTasks[0].title, 'Výlep billboardu Tesco');
  assert.equal(mirekActivity.loggedHoursToday, 3.5);

  const vladkaActivity = result.byUserId['u-vladka'];
  assert.equal(vladkaActivity.activeTasks.length, 1);
  assert.equal(vladkaActivity.activeTasks[0].acknowledged, true);

  const jirkaActivity = result.byUserId['u-jirka'];
  assert.equal(jirkaActivity.rescheduledTasks.length, 1);
  assert.match(jirkaActivity.rescheduledTasks[0].note || '', /Silný vítr/);
});

test('extractMeetingStructuredFallback extracts decisions, tasks, assignees, and dates', () => {
  const transcript = `
Porada vedení a montáží
Rozhodnutí: Od prosince zavádíme nový tiskový ceník.
Závěr: Mirek přebírá zodpovědnost za sklad v Opavě.
Mirek zkontroluje stav billboardů v Opavě zítra.
Vlaďka připraví faktury pro klienta ABC do 15.11.2026.
Ukol: Zařídit servis montážní plošiny.
  `;

  const extracted = extractMeetingStructuredFallback(transcript, mockMembers, '2026-11-12');

  assert.equal(extracted.title, 'Porada vedení a montáží');
  assert.ok(extracted.decisions.length >= 2);
  assert.ok(extracted.actionItems.length >= 2);

  const mirekTask = extracted.actionItems.find((t) => t.assigneeUserId === 'u-mirek');
  assert.ok(mirekTask);
  assert.equal(mirekTask?.dueDate, '2026-11-13');

  const vladkaTask = extracted.actionItems.find((t) => t.assigneeUserId === 'u-vladka');
  assert.ok(vladkaTask);
  assert.equal(vladkaTask?.dueDate, '2026-11-15');
});

test('renderMeetingReportEmail produces valid HTML and text with links', () => {
  const rendered = renderMeetingReportEmail(
    {
      id: 'rep-1',
      title: 'Týdenní operativní porada',
      meetingDate: '2026-11-12',
      createdAt: '2026-11-12T10:00:00Z',
      createdByName: 'Pavel',
      sourceType: 'TRANSCRIPT',
      summary: 'Probrali jsme vytížení montážních posádek a nové nabídky.',
      decisions: ['Schválen nákup nové plachty'],
      actionItems: [
        {
          id: 'item-1',
          title: 'Zavolat klientovi KFC',
          assigneeName: 'Vladimíra Dvořáková',
          assigneeUserId: 'u-vladka',
          dueDate: '2026-11-13',
          priority: 'HIGH',
          estimatedHours: 1,
          createWorkOrder: true,
          addToMyPlannerBlock: false,
          createdWorkOrderId: 'wo-kfc-1',
        },
      ],
      emailedToCount: 3,
    },
    'SeePoint s.r.o.'
  );

  assert.match(rendered.subject, /Zápis z porady: Týdenní operativní porada/);
  assert.match(rendered.html, /SeePoint s\.r\.o\./);
  assert.match(rendered.html, /Schválen nákup nové plachty/);
  assert.match(rendered.html, /Zavolat klientovi KFC/);
  assert.match(rendered.html, /Vladimíra Dvořáková/);
  assert.match(rendered.html, /\/work\/wo-kfc-1/);
});

test('sanitizeMeetingReports filters invalid objects and retains valid report records', () => {
  const sanitized = sanitizeMeetingReports([
    null,
    'invalid',
    { id: 'r1', title: 'Porada 1', meetingDate: '2026-11-12' },
    { missingTitle: true },
  ]);
  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].id, 'r1');
  assert.equal(sanitized[0].title, 'Porada 1');
});
