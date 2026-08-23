import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveOnboardingProgress } from '../lib/organization-onboarding.ts';

const emptyRecord = {
  companyCompletedAt: null,
  ownerCompletedAt: null,
  settingsCompletedAt: null,
  inventoryCompletedAt: null,
  teamCompletedAt: null,
};

test('onboarding derives automatic steps only from the active organization evidence', () => {
  const organizationA = deriveOnboardingProgress(emptyRecord, {
    hasCompany: true,
    hasActiveOwner: true,
    surfaceCount: 12,
    activeMemberCount: 3,
  });
  const organizationB = deriveOnboardingProgress(emptyRecord, {
    hasCompany: true,
    hasActiveOwner: true,
    surfaceCount: 0,
    activeMemberCount: 1,
  });

  assert.equal(organizationA.completed.INVENTORY, true);
  assert.equal(organizationA.completed.TEAM, true);
  assert.equal(organizationB.completed.INVENTORY, false);
  assert.equal(organizationB.completed.TEAM, false);
  assert.equal(organizationB.currentStep, 'SETTINGS');
});

test('onboarding remains resumable and finishes after every persisted step', () => {
  const now = new Date('2030-01-01T00:00:00Z');
  const progress = deriveOnboardingProgress({
    companyCompletedAt: now,
    ownerCompletedAt: now,
    settingsCompletedAt: now,
    inventoryCompletedAt: now,
    teamCompletedAt: now,
  }, {
    hasCompany: true,
    hasActiveOwner: true,
    surfaceCount: 0,
    activeMemberCount: 1,
  });

  assert.equal(progress.completedCount, 5);
  assert.equal(progress.percent, 100);
  assert.equal(progress.currentStep, 'COMPLETED');
  assert.equal(progress.isCompleted, true);
});
