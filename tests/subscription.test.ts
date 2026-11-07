import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSubscriptionState, getPlanSpecification } from '../lib/subscription';

test('getPlanSpecification returns expected limits and prices for START, BUSINESS, PRO', () => {
  const start = getPlanSpecification('START');
  assert.equal(start.surfaceLimit, 100);
  assert.equal(start.userLimit, 3);
  assert.equal(start.monthlyPriceCzk, 1900);

  const business = getPlanSpecification('BUSINESS');
  assert.equal(business.surfaceLimit, 500);
  assert.equal(business.userLimit, 10);
  assert.equal(business.monthlyPriceCzk, 4900);

  const pro = getPlanSpecification('PRO');
  assert.equal(pro.surfaceLimit, 2000);
  assert.equal(pro.userLimit, null);
  assert.equal(pro.monthlyPriceCzk, 9900);
});

test('evaluateSubscriptionState never renders banner for default SeePoint org or ACTIVE org', () => {
  const now = Date.UTC(2026, 10, 7, 12, 0, 0);

  const seepoint = evaluateSubscriptionState(
    {
      id: 'org_seepoint_default',
      plan: 'BUSINESS',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(now - 5 * 86400000),
    },
    now
  );
  assert.equal(seepoint.status, 'INTERNAL');
  assert.equal(seepoint.banner, null);

  const active = evaluateSubscriptionState(
    {
      id: 'org_client_1',
      plan: 'BUSINESS',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    },
    now
  );
  assert.equal(active.status, 'ACTIVE');
  assert.equal(active.banner, null);
});

test('evaluateSubscriptionState shows info/warning/danger banners for TRIAL and PAST_DUE states', () => {
  const now = Date.UTC(2026, 10, 7, 12, 0, 0);

  const trial10Days = evaluateSubscriptionState(
    {
      id: 'org_pilot',
      plan: 'BUSINESS',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(now + 10 * 86400000),
    },
    now
  );
  assert.equal(trial10Days.trialDaysRemaining, 10);
  assert.equal(trial10Days.isTrialExpired, false);
  assert.equal(trial10Days.banner?.tone, 'info');

  const trial3Days = evaluateSubscriptionState(
    {
      id: 'org_pilot',
      plan: 'BUSINESS',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(now + 3 * 86400000),
    },
    now
  );
  assert.equal(trial3Days.trialDaysRemaining, 3);
  assert.equal(trial3Days.banner?.tone, 'warning');

  const trialExpired = evaluateSubscriptionState(
    {
      id: 'org_pilot',
      plan: 'BUSINESS',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(now - 2 * 86400000),
    },
    now
  );
  assert.equal(trialExpired.isTrialExpired, true);
  assert.equal(trialExpired.banner?.tone, 'danger');

  const pastDue = evaluateSubscriptionState(
    {
      id: 'org_pilot',
      plan: 'PRO',
      subscriptionStatus: 'PAST_DUE',
      trialEndsAt: null,
    },
    now
  );
  assert.equal(pastDue.status, 'PAST_DUE');
  assert.equal(pastDue.banner?.tone, 'warning');
});
