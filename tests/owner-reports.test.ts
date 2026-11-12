import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDeterministicOwnerExecutiveSummary,
  buildSalesDailySummary,
  buildUserAutoDaySummary,
  renderApprovalDecisionEmail,
  renderApprovalNotificationEmail,
  sanitizeApprovalRequests,
  sanitizeCheckouts,
} from '../lib/planner/owner-reports';
import type { PulseMemberRef } from '../lib/planner/team-pulse';

const members: PulseMemberRef[] = [
  { userId: 'u-vladka', name: 'Vladimíra Dvořáková', employeeId: 'emp-1' },
  { userId: 'u-mirek', name: 'Miroslav Novák', employeeId: 'emp-2' },
];

test('buildSalesDailySummary aggregates offers and CRM tasks accurately', () => {
  const summary = buildSalesDailySummary({
    date: '2026-11-12',
    timezone: 'Europe/Prague',
    members,
    offers: [
      {
        id: 'off-1',
        title: 'KFC Opava',
        status: 'SENT',
        totalPrice: 120000,
        subtotal: 100000,
        createdByUserId: 'u-vladka',
        createdAt: new Date('2026-11-12T08:00:00Z'),
        sentAt: new Date('2026-11-12T10:00:00Z'),
        acceptedAt: null,
      },
      {
        id: 'off-2',
        title: 'Tesco Brno',
        status: 'ACCEPTED',
        totalPrice: 60000,
        subtotal: 50000,
        createdByUserId: 'u-vladka',
        createdAt: new Date('2026-11-10T08:00:00Z'),
        sentAt: new Date('2026-11-11T09:00:00Z'),
        acceptedAt: new Date('2026-11-12T11:00:00Z'),
      },
    ],
    crmTasks: [
      {
        id: 'crm-1',
        title: 'Zavolat KFC',
        status: 'DONE',
        assignedUserId: 'u-vladka',
        completedAt: new Date('2026-11-12T09:30:00Z'),
      },
    ],
  });

  assert.equal(summary.offersCreatedToday, 1);
  assert.equal(summary.offersSentToday, 1);
  assert.equal(summary.offersSentValueCzk, 120000);
  assert.equal(summary.offersAcceptedToday, 1);
  assert.equal(summary.offersAcceptedValueCzk, 60000);
  assert.equal(summary.crmTasksDoneToday, 1);

  const vladkaSales = summary.byUserId['u-vladka'];
  assert.equal(vladkaSales.offersSentCount, 1);
  assert.equal(vladkaSales.offersAcceptedCount, 1);
  assert.equal(vladkaSales.crmTasksDoneCount, 1);
});

test('buildUserAutoDaySummary combines sales and work metrics into concise Czech text', () => {
  const txt = buildUserAutoDaySummary({
    sales: {
      offersSentCount: 2,
      offersSentValueCzk: 180000,
      offersAcceptedCount: 1,
      crmTasksDoneCount: 3,
    },
    work: {
      activeTasks: [],
      completedTasks: [
        {
          id: 'wo-1',
          title: 'Výlep',
          status: 'DONE',
          href: '/work/wo-1',
        },
      ],
      rescheduledTasks: [],
      loggedHoursToday: 4.5,
      entriesCountToday: 1,
    },
  });

  assert.match(txt, /2 odesl\. nabídky/);
  assert.match(txt, /3 CRM úkoly/);
  assert.match(txt, /1 hotov\. zakázka/);
  assert.match(txt, /4\.5 h vykázáno/);
});

test('buildDeterministicOwnerExecutiveSummary highlights pending approvals and missing reports', () => {
  const res = buildDeterministicOwnerExecutiveSummary({
    date: '2026-11-12',
    companyPulse: {
      date: '2026-11-12',
      activeCount: 2,
      acknowledgedCount: 2,
      completedCount: 3,
      rescheduledCount: 1,
      loggedHoursTotal: 12,
      recentFeed: [],
    },
    sales: {
      offersCreatedToday: 1,
      offersSentToday: 1,
      offersAcceptedToday: 0,
      offersSentValueCzk: 95000,
      offersAcceptedValueCzk: 0,
      crmTasksDoneToday: 2,
      byUserId: {},
    },
    members,
    checkoutsByUserId: {
      'u-vladka': {
        id: 'chk-1',
        date: '2026-11-12',
        userId: 'u-vladka',
        userName: 'Vladimíra Dvořáková',
        submittedAt: '2026-11-12T16:00:00Z',
        autoSummary: '1 odeslaná nabídka',
        manualSummary: 'Poslána smlouva klientovi',
      },
    },
    pendingApprovals: [
      {
        id: 'appr-1',
        date: '2026-11-12',
        requesterUserId: 'u-vladka',
        requesterName: 'Vladimíra Dvořáková',
        category: 'DISCOUNT',
        title: 'Sleva 12 % pro KFC',
        detail: 'Dlouhodobá roční smlouva',
        amountLabel: '-14 000 Kč',
        status: 'PENDING',
        createdAt: '2026-11-12T15:00:00Z',
      },
    ],
  });

  assert.match(res.headline, /1 čekajících schválení/);
  assert.ok(res.attentionPoints.some((p) => p.includes('Miroslav Novák')));
  assert.ok(res.highlights.some((h) => h.includes('95')));
});

test('sanitize helpers and approval email templates handle records cleanly', () => {
  const cleanCheckouts = sanitizeCheckouts([
    null,
    { id: 'c1', date: '2026-11-12', userId: 'u1', userName: 'Pavel', manualSummary: 'Hotovo' },
  ]);
  assert.equal(cleanCheckouts.length, 1);

  const cleanApprovals = sanitizeApprovalRequests([
    { invalid: true },
    { id: 'a1', requesterUserId: 'u1', title: 'Sleva', category: 'DISCOUNT', status: 'PENDING' },
  ]);
  assert.equal(cleanApprovals.length, 1);

  const notif = renderApprovalNotificationEmail(cleanApprovals[0], 'SeePoint');
  assert.match(notif.subject, /Ke schválení/);
  assert.match(notif.html, /Sleva/);

  const decided = renderApprovalDecisionEmail(
    { ...cleanApprovals[0], status: 'APPROVED', decidedByName: 'Majitel', decisionNote: 'Souhlasím' },
    'SeePoint'
  );
  assert.match(decided.subject, /SCHVÁLENO/);
  assert.match(decided.html, /Souhlasím/);
});
