import test from 'node:test';
import assert from 'node:assert/strict';
import type { ElectionRemovalPointStatus } from '@prisma/client';

interface MockPoint {
  id: string;
  campaignId: string;
  status: ElectionRemovalPointStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  completedByUserId: string | null;
  issueType: string | null;
  issueNote: string | null;
  issueReportedAt: Date | null;
  issueReportedByUserId: string | null;
}

interface MockCampaign {
  id: string;
  totalPoints: number;
  completedPoints: number;
  status: string;
}

// Simulated domain state transition engine mirroring PATCH /api/election-removal/points/[id]/status
function applyPointAction(
  point: MockPoint,
  campaign: MockCampaign,
  action: 'START' | 'COMPLETE' | 'REPORT_ISSUE' | 'RESET',
  userId: string,
  extra?: { issueType?: string; issueNote?: string }
): { point: MockPoint; campaign: MockCampaign } {
  const now = new Date('2026-10-06T12:00:00Z');
  const wasCompleted = point.status === 'COMPLETED';

  let nextPoint = { ...point };
  let nextCampaign = { ...campaign };

  if (action === 'START') {
    nextPoint.status = 'IN_PROGRESS';
    nextPoint.startedAt = point.startedAt ?? now;
  } else if (action === 'COMPLETE') {
    nextPoint.status = 'COMPLETED';
    nextPoint.completedAt = now;
    nextPoint.completedByUserId = userId;
    nextPoint.issueType = null;
    nextPoint.issueNote = null;

    if (!wasCompleted) {
      nextCampaign.completedPoints += 1;
    }
  } else if (action === 'REPORT_ISSUE') {
    nextPoint.status = 'ISSUE';
    nextPoint.issueType = extra?.issueType || 'OTHER';
    nextPoint.issueNote = extra?.issueNote || null;
    nextPoint.issueReportedAt = now;
    nextPoint.issueReportedByUserId = userId;

    if (wasCompleted) {
      nextCampaign.completedPoints = Math.max(0, nextCampaign.completedPoints - 1);
    }
  } else if (action === 'RESET') {
    nextPoint.status = 'ASSIGNED';
    nextPoint.completedAt = null;
    nextPoint.completedByUserId = null;
    nextPoint.issueType = null;
    nextPoint.issueNote = null;

    if (wasCompleted) {
      nextCampaign.completedPoints = Math.max(0, nextCampaign.completedPoints - 1);
    }
  }

  return { point: nextPoint, campaign: nextCampaign };
}

test('Field Execution Lifecycle: START -> COMPLETE increments campaign counter', () => {
  let point: MockPoint = {
    id: 'pt-1',
    campaignId: 'camp-1',
    status: 'ASSIGNED',
    startedAt: null,
    completedAt: null,
    completedByUserId: null,
    issueType: null,
    issueNote: null,
    issueReportedAt: null,
    issueReportedByUserId: null,
  };

  let campaign: MockCampaign = {
    id: 'camp-1',
    totalPoints: 10,
    completedPoints: 0,
    status: 'PLANNED',
  };

  // 1. Worker clicks START on site
  const step1 = applyPointAction(point, campaign, 'START', 'user-worker-1');
  assert.equal(step1.point.status, 'IN_PROGRESS');
  assert.ok(step1.point.startedAt);
  assert.equal(step1.campaign.completedPoints, 0);

  // 2. Worker completes deinstallation
  const step2 = applyPointAction(step1.point, step1.campaign, 'COMPLETE', 'user-worker-1');
  assert.equal(step2.point.status, 'COMPLETED');
  assert.ok(step2.point.completedAt);
  assert.equal(step2.point.completedByUserId, 'user-worker-1');
  assert.equal(step2.campaign.completedPoints, 1);

  // 3. Completing again should be idempotent
  const step3 = applyPointAction(step2.point, step2.campaign, 'COMPLETE', 'user-worker-1');
  assert.equal(step3.campaign.completedPoints, 1);
});

test('Field Execution Lifecycle: REPORT_ISSUE captures issue details and decrements if was completed', () => {
  let point: MockPoint = {
    id: 'pt-2',
    campaignId: 'camp-1',
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    completedAt: null,
    completedByUserId: null,
    issueType: null,
    issueNote: null,
    issueReportedAt: null,
    issueReportedByUserId: null,
  };

  let campaign: MockCampaign = {
    id: 'camp-1',
    totalPoints: 10,
    completedPoints: 2,
    status: 'PLANNED',
  };

  // Report issue from field: NOT_FOUND
  const step1 = applyPointAction(point, campaign, 'REPORT_ISSUE', 'user-worker-1', {
    issueType: 'NOT_FOUND',
    issueNote: 'Nosič nebyl nalezen na křižovatce, zřejmě již dříve odstraněn.',
  });

  assert.equal(step1.point.status, 'ISSUE');
  assert.equal(step1.point.issueType, 'NOT_FOUND');
  assert.equal(step1.point.issueNote, 'Nosič nebyl nalezen na křižovatce, zřejmě již dříve odstraněn.');
  assert.equal(step1.point.issueReportedByUserId, 'user-worker-1');
  assert.ok(step1.point.issueReportedAt);
  assert.equal(step1.campaign.completedPoints, 2);

  // Later resolved and marked COMPLETED
  const step2 = applyPointAction(step1.point, step1.campaign, 'COMPLETE', 'user-worker-1');
  assert.equal(step2.point.status, 'COMPLETED');
  assert.equal(step2.point.issueType, null);
  assert.equal(step2.point.issueNote, null);
  assert.equal(step2.campaign.completedPoints, 3);
});

test('Field Execution: Photo evidence structure uses AFTER_DEINSTALLATION photo type', () => {
  const photoPayload = {
    id: 'photo-1',
    electionRemovalPointId: 'pt-1',
    type: 'AFTER_DEINSTALLATION',
    url: '/api/photos/photo-1/file',
    fileName: 'pt-1-demontaz.jpg',
    capturedLatitude: 50.088,
    capturedLongitude: 14.42,
    capturedByWorkerUserId: 'user-worker-1',
  };

  assert.equal(photoPayload.type, 'AFTER_DEINSTALLATION');
  assert.equal(photoPayload.electionRemovalPointId, 'pt-1');
  assert.equal(photoPayload.capturedLatitude, 50.088);
  assert.equal(photoPayload.capturedLongitude, 14.42);
});
