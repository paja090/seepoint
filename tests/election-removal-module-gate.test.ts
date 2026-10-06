import assert from 'node:assert/strict';
import test from 'node:test';
import { getOrganizationEnabledModules, isModuleEnabled } from '../lib/organization-modules';
import { hasModuleAccess } from '../lib/module-policy';
import { getVisibleNavigation } from '../lib/navigation';

test('electionRemoval module is disabled by default for ALL organization plans', () => {
  const plans = ['START', 'BUSINESS', 'PRO', 'ENTERPRISE', 'INTERNAL'] as const;
  for (const plan of plans) {
    const org = { plan, enabledModules: null };
    const modules = getOrganizationEnabledModules(org);
    assert.equal(
      modules.electionRemoval,
      false,
      `electionRemoval should be false by default for plan ${plan}`
    );
    assert.equal(
      isModuleEnabled(org, 'electionRemoval'),
      false,
      `isModuleEnabled should return false for plan ${plan}`
    );
  }
});

test('electionRemoval module is active ONLY with explicit tenant override', () => {
  const seepointOrg = {
    plan: 'INTERNAL',
    enabledModules: { electionRemoval: true },
  };
  const modules = getOrganizationEnabledModules(seepointOrg);
  assert.equal(modules.electionRemoval, true);
  assert.equal(isModuleEnabled(seepointOrg, 'electionRemoval'), true);

  const otherOrg = {
    plan: 'ENTERPRISE',
    enabledModules: { electionRemoval: false },
  };
  assert.equal(isModuleEnabled(otherOrg, 'electionRemoval'), false);
});

test('hasModuleAccess respects RBAC and tenant module activation', () => {
  const enabledOrg = { id: 'org_seepoint_default', isActive: true, plan: 'INTERNAL', enabledModules: { electionRemoval: true } };
  const disabledOrg = { id: 'org_other_tenant', isActive: true, plan: 'PRO', enabledModules: {} };

  // Enabled org + ADMIN -> OK
  assert.equal(
    hasModuleAccess({
      role: 'ADMIN',
      organizationId: enabledOrg.id,
      organization: enabledOrg,
      membership: { organizationId: enabledOrg.id, isActive: true },
    }, 'electionRemoval'),
    true
  );

  // Enabled org + MANAGER -> OK
  assert.equal(
    hasModuleAccess({
      role: 'MANAGER',
      organizationId: enabledOrg.id,
      organization: enabledOrg,
      membership: { organizationId: enabledOrg.id, isActive: true },
    }, 'electionRemoval'),
    true
  );

  // Enabled org + VIEWER -> DENIED (RBAC)
  assert.equal(
    hasModuleAccess({
      role: 'VIEWER',
      organizationId: enabledOrg.id,
      organization: enabledOrg,
      membership: { organizationId: enabledOrg.id, isActive: true },
    }, 'electionRemoval'),
    false
  );

  // Disabled org + ADMIN -> DENIED (Module disabled)
  assert.equal(
    hasModuleAccess({
      role: 'ADMIN',
      organizationId: disabledOrg.id,
      organization: disabledOrg,
      membership: { organizationId: disabledOrg.id, isActive: true },
    }, 'electionRemoval'),
    false
  );
});

test('getVisibleNavigation hides election-removal for unauthorized organizations', () => {
  const seepointUser = {
    role: 'MANAGER' as const,
    organization: { plan: 'INTERNAL', enabledModules: { electionRemoval: true } },
    membership: { role: 'MANAGER', roles: [] },
  };
  const standardUser = {
    role: 'MANAGER' as const,
    organization: { plan: 'PRO', enabledModules: {} },
    membership: { role: 'MANAGER', roles: [] },
  };

  const seepointNav = getVisibleNavigation(seepointUser);
  const seepointAllHrefs = seepointNav.flatMap(h => h.groups.flatMap(g => g.items.map(i => i[0])));
  assert.ok(
    seepointAllHrefs.includes('/election-removal'),
    'SeePoint user must see /election-removal in navigation'
  );

  const standardNav = getVisibleNavigation(standardUser);
  const standardAllHrefs = standardNav.flatMap(h => h.groups.flatMap(g => g.items.map(i => i[0])));
  assert.ok(
    !standardAllHrefs.includes('/election-removal'),
    'Standard tenant user must NOT see /election-removal in navigation'
  );
});
